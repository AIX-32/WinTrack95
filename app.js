import { Win95Dialog, startupSound } from './startup.js';

let audioContext;
let audioSource;
let bassFilter;
let trebleFilter;
let analyser;
let visualizationMode = 'waveform';
let crossfadeTime = 0;
let nextAudio = null;
let nextAudioSource = null;
let isTransitioning = false;

const audio = new Audio();
const dialog = new Win95Dialog();

let hasInteracted = false;

window.addEventListener('DOMContentLoaded', () => {
    if (!hasInteracted) {
        dialog.show('Click anywhere to enter');
    }
});

document.addEventListener('click', () => {
    if (!hasInteracted) {
        hasInteracted = true;
        dialog.hide(); 

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                startupSound.play().catch(error => {
                    console.error('Failed to play startup sound:', error);
                    dialog.show('Failed to play startup sound.');
                });
            });
        } else {
            startupSound.play().catch(error => {
                console.error('Failed to play startup sound:', error);
                dialog.show('Failed to play startup sound.');
            });
        }
    }
});
let currentTrack = null;
let playlists = [];
let db;

const initDB = () => {
  const request = indexedDB.open('mediaPlayerDB', 1);

  request.onerror = (event) => {
    console.error('Database error:', event.target.error);
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    loadPlaylists();
    loadTracks();
  };

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('tracks')) {
      db.createObjectStore('tracks', { keyPath: 'dataURL' });
    }
    if (!db.objectStoreNames.contains('playlists')) {
      db.createObjectStore('playlists', { keyPath: 'name' });
    }
  };
};

const loadTracks = () => {
  const transaction = db.transaction(['tracks'], 'readonly');
  const store = transaction.objectStore('tracks');
  const request = store.getAll();

  request.onsuccess = () => {
    const tracks = request.result;
    const trackList = document.querySelector('.track-list');
    trackList.innerHTML = '';

    tracks.forEach(track => {
      const mediaItem = createTrackElement(track);
      trackList.appendChild(mediaItem);
    });
  };
};

const createTrackElement = (track) => {
  const mediaItem = document.createElement('div');
  mediaItem.className = 'track media-item';
  mediaItem.setAttribute('data-src', track.dataURL);

  const title = document.createElement('span');
  title.className = 'media-title';
  title.textContent = track.name.replace(/\.[^/.]+$/, '');

  mediaItem.appendChild(title);
  mediaItem.addEventListener('click', trackHandler);
  mediaItem.addEventListener('contextmenu', trackHandler);

  return mediaItem;
};

let currentPlaylist = null;

document.getElementById('volumeControl').addEventListener('input', (e) => {
    audio.volume = e.target.value;
});

function loadPlaylists() {
  const transaction = db.transaction(['playlists'], 'readonly');
  const store = transaction.objectStore('playlists');
  const request = store.getAll();

  request.onsuccess = () => {
    playlists = request.result;
    renderPlaylists();
  };

  request.onerror = (event) => {
    console.error('Error loading playlists:', event.target.error);
  };
}

let isLooping = false;
audio.loop = isLooping;

let dragElement = null;
let posX = 0, posY = 0, startX = 0, startY = 0;

const startDrag = (e) => {
  // Prevent default to avoid text selection and touch actions
  e.preventDefault();
  
  if (e.target.closest('.title-bar')) {
    // Prevent multiple drags
    if (dragElement) return;
    
    dragElement = e.target.closest('.window');
    const rect = dragElement.getBoundingClientRect();
    
    // Store initial positions
    posX = rect.left;
    posY = rect.top;
    startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    
    // Add styles to prevent text selection and improve dragging performance
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    dragElement.style.cursor = 'grabbing';
    dragElement.style.transition = 'none'; // Disable transitions during drag
    
    // Add appropriate event listeners based on input type
    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', moveWindow);
      document.addEventListener('mouseup', stopDrag, { once: true });
    } else {
      // Prevent scrolling on touch devices
      document.body.style.overflow = 'hidden';
      document.addEventListener('touchmove', moveWindow, { passive: false });
      document.addEventListener('touchend', stopDrag, { once: true });
    }
  }
};

const moveWindow = (e) => {
  // Prevent default to avoid text selection, touch actions, and scrolling
  e.preventDefault();
  e.stopPropagation();
  
  if (!dragElement) return;
  
  // Get current touch/mouse position
  const currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
  const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
  
  // Calculate new position
  let newX = posX + (currentX - startX);
  let newY = posY + (currentY - startY);
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get window dimensions
  const windowWidth = dragElement.offsetWidth;
  const windowHeight = dragElement.offsetHeight;
  
  // Calculate boundaries with a small margin
  const margin = 20;
  const minX = 0; // Allow dragging to the left edge
  const maxX = Math.max(0, viewportWidth - windowWidth); // Don't go beyond right edge
  const minY = 0; // Allow dragging to the top edge
  const maxY = viewportHeight - 30; // Keep title bar visible at bottom
  
  // Clamp the position to stay within viewport
  newX = Math.max(minX, Math.min(newX, maxX));
  newY = Math.max(minY, Math.min(newY, maxY));
  
  // Apply the new position
  dragElement.style.left = `${newX}px`;
  dragElement.style.top = `${newY}px`;
};

const stopDrag = (e) => {
  if (!dragElement) return;
  
  // Re-enable text selection and restore styles
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  document.body.style.overflow = '';
  
  if (dragElement) {
    dragElement.style.cursor = '';
    dragElement.style.transition = '';
    
    // Ensure the window is fully within viewport when dropped
    const rect = dragElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = rect.left;
    let newY = rect.top;
    
    // If window is partially out of view, adjust its position
    if (rect.right < 0) newX = 0;
    if (rect.bottom < 30) newY = 0; // 30px is roughly the title bar height
    if (rect.left > viewportWidth) newX = viewportWidth - rect.width;
    if (rect.top > viewportHeight) newY = viewportHeight - 30; // Keep title bar visible
    
    // Apply final position if needed
    if (newX !== rect.left || newY !== rect.top) {
      dragElement.style.left = `${newX}px`;
      dragElement.style.top = `${newY}px`;
    }
  }
  
  // Clean up event listeners
  document.removeEventListener('mousemove', moveWindow);
  document.removeEventListener('touchmove', moveWindow);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
  
  dragElement = null;
};

document.addEventListener('mousedown', startDrag);
// Handle touch events for draggable elements
document.addEventListener('touchstart', (e) => {
    // Only handle drag if it's on a title bar
    if (e.target.closest('.title-bar')) {
        e.preventDefault();
        startDrag(e);
    }
    // Don't prevent default for taskbar buttons
    else if (e.target.closest('#taskbar button, #taskbar .app')) {
        return; // Allow default behavior for taskbar buttons
    }
    // Prevent default for other elements to avoid scrolling
    else if (!e.target.closest('input, button, select, textarea, .track-list, .playlist-list, .content')) {
        e.preventDefault();
    }
}, { passive: false });

// Only prevent default on touchmove for non-interactive elements
document.body.addEventListener('touchmove', (e) => {
    // Allow interaction with these elements
    if (e.target.closest('.track-list, .playlist-list, .content, input, button, select, textarea, #taskbar')) {
        return; // Allow default behavior for interactive elements
    }
    e.preventDefault();
}, { passive: false });

// Prevent pinch-zoom on non-interactive elements
document.addEventListener('gesturestart', (e) => {
    if (!e.target.closest('input, button, select, textarea, .track-list, .playlist-list, #taskbar')) {
        e.preventDefault();
    }
}, { passive: false });

function initAudio() {

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  bassFilter = audioContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 200;

  trebleFilter = audioContext.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 2000;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  audio.addEventListener('play', connectAudioNodes);
}

function connectAudioNodes() {
  try {

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    if (audioSource) {
      try {
        audioSource.disconnect();
      } catch (e) {
        console.warn('Error disconnecting audio source:', e);
      }
    }

    if (!audioSource || audioSource.mediaElement !== audio) {
      audioSource = audioContext.createMediaElementSource(audio);
    }

    audioSource.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (error) {
    console.error('Error connecting audio nodes:', error);

    audioSource = null;
  }
}

function crossfadeToTrack(newTrackSrc) {

  const cleanup = () => {
    if (audioSource) {
      try { audioSource.disconnect(); } catch (e) {
        console.warn('Error disconnecting audio source:', e);
      }
      audioSource = null;
    }
    if (nextAudioSource) {
      try { nextAudioSource.disconnect(); } catch (e) {
        console.warn('Error disconnecting next audio source:', e);
      }
      nextAudioSource = null;
    }
    if (nextAudio) {
      try { nextAudio.pause(); } catch (e) {
        console.warn('Error pausing next audio:', e);
      }
      nextAudio = null;
    }
  };

  cleanup();
  isTransitioning = false;

  if (crossfadeTime <= 0 || !audio.duration || audio.paused) {

    audio.src = newTrackSrc;
    audio.play().then(() => {
      connectAudioNodes(); 
    }).catch(e => {
      console.error('Error playing audio:', e);
      cleanup(); 
    });
    return;
  }

  if (isTransitioning) {

    if (nextAudio) nextAudio.src = newTrackSrc;
    return;
  }

  isTransitioning = true;

  nextAudio = new Audio();
  nextAudio.src = newTrackSrc;
  nextAudio.volume = 0;

  nextAudio.play().catch(e => console.error('Error playing next audio:', e));

  nextAudioSource = audioContext.createMediaElementSource(nextAudio);
  nextAudioSource.connect(audioContext.destination);

  const fadeOutDuration = crossfadeTime * 1000;
  const startTime = audioContext.currentTime;
  const endTime = startTime + crossfadeTime;

  const fadeInterval = setInterval(() => {
    const currentTime = audioContext.currentTime;
    const progress = (currentTime - startTime) / crossfadeTime;

    if (progress >= 1) {

      clearInterval(fadeInterval);
      audio.pause();

      const oldAudio = audio;
      audio = nextAudio;
      nextAudio = null;

      try { oldAudio.pause(); } catch (e) {}
      if (audioSource) {
        try { audioSource.disconnect(); } catch (e) {}
        audioSource = null;
      }

      audioSource = nextAudioSource;
      nextAudioSource = null;
      isTransitioning = false;
    } else {

      audio.volume = 1 - progress;
      nextAudio.volume = progress;
    }
  }, 50);
}

function drawVisualization() {
  const canvas = document.getElementById('visualizer');
  if (!canvas || !analyser) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function animate() {
    requestAnimationFrame(animate);

    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    if (visualizationMode === 'waveform') {

      analyser.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 255, 0)';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else if (visualizationMode === 'spectrum') {

      analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 255 * height;

        const hue = i / bufferLength * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    }
  }

  animate();
}

let windowStates = {
  'Library': true,
  'Player': true,
  'Settings': true,
  'Playlists': true,
};
let currentZIndex = 1000;

window.addEventListener('DOMContentLoaded', () => {

  initDB();

  initAudio();

  const windows = {
    'Library': document.querySelector('.window:nth-child(6)'),
    'Player': document.querySelector('.window:nth-child(3)'),
    'Settings': document.querySelector('.window:nth-child(4)'),
    'Playlists': document.querySelector('.window:nth-child(5)'),
  };

  Object.entries(windows).forEach(([name, window]) => {
    window.style.display = windowStates[name] ? 'block' : 'none';
    window.style.zIndex = currentZIndex++;

    window.addEventListener('mousedown', () => {
      window.style.zIndex = ++currentZIndex;
    });
  });

  document.querySelectorAll('.app').forEach(button => {
    const windowName = button.textContent;
    button.addEventListener('click', () => {
      const window = windows[windowName];
      if (window) {
        windowStates[windowName] = !windowStates[windowName];
        window.style.display = windowStates[windowName] ? 'block' : 'none';
        button.style.backgroundColor = windowStates[windowName] ? '#a0a0a0' : '#c0c0c0';
      }
    });

    button.style.backgroundColor = windowStates[windowName] ? '#a0a0a0' : '#c0c0c0';
  });

  loadPlaylists();

  drawVisualization();

  document.getElementById('bassControl').addEventListener('input', (e) => {
    if (bassFilter) {
      bassFilter.gain.value = parseFloat(e.target.value);
    }
  });

  document.getElementById('trebleControl').addEventListener('input', (e) => {
    if (trebleFilter) {
      trebleFilter.gain.value = parseFloat(e.target.value);
    }
  });

  document.getElementById('crossfadeControl').addEventListener('input', (e) => {
    crossfadeTime = parseFloat(e.target.value);
    document.getElementById('crossfadeValue').textContent = crossfadeTime + 's';
  });

  document.getElementById('waveformBtn').addEventListener('click', () => {
    visualizationMode = 'waveform';
    document.getElementById('waveformBtn').style.backgroundColor = '#808080';
    document.getElementById('spectrumBtn').style.backgroundColor = '#c0c0c0';
  });

  document.getElementById('spectrumBtn').addEventListener('click', () => {
    visualizationMode = 'spectrum';
    document.getElementById('spectrumBtn').style.backgroundColor = '#808080';
    document.getElementById('waveformBtn').style.backgroundColor = '#c0c0c0';
  });

  document.querySelectorAll('.window').forEach(win => {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const rect = win.getBoundingClientRect();

    const maxX = vw - rect.width;
    const maxY = vh - rect.height;

    win.style.left = `${Math.max(0, Math.random() * maxX)}px`;
    win.style.top = `${Math.max(0, Math.random() * maxY)}px`;
  });

  const trackList = document.querySelector('.track-list');
  JSON.parse(localStorage.getItem('mediaTracks') || '[]').forEach(track => {
    const thumbnail = document.createElement('img');
    thumbnail.src = track.type.startsWith('audio/') ? 'icons/music-note.png' : 'icons/video-thumbnail.png';
    const mediaItem = document.createElement('div');
    mediaItem.className = 'track media-item';
    mediaItem.setAttribute('data-src', track.dataURL);

    thumbnail.className = 'media-thumbnail';
    thumbnail.src = track.dataURL;

    const title = document.createElement('span');
    title.className = 'media-title';
    title.textContent = track.name.replace(/\.[^/.]+$/, '');

    mediaItem.appendChild(thumbnail);
    mediaItem.appendChild(title);
    mediaItem.addEventListener('click', trackHandler);
    trackList.appendChild(mediaItem);
  });
});

function addTrackToList(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const trackData = {
      name: file.name,
      dataURL: e.target.result,
      type: file.type
    };

    const transaction = db.transaction(['tracks'], 'readwrite');
    const store = transaction.objectStore('tracks');
    const request = store.add(trackData);

    request.onsuccess = () => {
      const mediaItem = createTrackElement(trackData);
      document.querySelector('.track-list').appendChild(mediaItem);
    };

    request.onerror = (event) => {
      console.error('Error adding track:', event.target.error);
    };
  };
  reader.readAsDataURL(file);
}

const trackHandler = (event) => {

  if (event.button === 2) {
    event.preventDefault();
    showPlaylistContextMenu(event, event.currentTarget);
    return;
  }

  const track = event.currentTarget;
  const newTrackSrc = track.getAttribute('data-src');

  if (crossfadeTime > 0 && audio.duration && !audio.paused && currentTrack !== newTrackSrc) {
    crossfadeToTrack(newTrackSrc);
  } else {
    audio.src = newTrackSrc;
    audio.play();
  }

  currentTrack = newTrackSrc;
  document.querySelectorAll('.track').forEach(t => t.classList.remove('active'));
  track.classList.add('active');
  document.getElementById('playBtn').textContent = '⏸ Pause';

  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
};

function showPlaylistContextMenu(event, track) {

  const existingMenu = document.querySelector('.context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.backgroundColor = '#c0c0c0';
  contextMenu.style.border = '2px outset #fff';
  contextMenu.style.padding = '2px';
  contextMenu.style.zIndex = '1000';

  const header = document.createElement('div');
  header.textContent = 'Add to playlist:';
  header.style.padding = '4px';
  header.style.borderBottom = '1px solid #808080';
  header.style.fontWeight = 'bold';
  contextMenu.appendChild(header);

  if (playlists.length === 0) {
    const noPlaylists = document.createElement('div');
    noPlaylists.textContent = 'No playlists available';
    noPlaylists.style.padding = '4px';
    contextMenu.appendChild(noPlaylists);
  } else {
    playlists.forEach(playlist => {
      const option = document.createElement('div');
      option.textContent = playlist.name;
      option.style.padding = '4px';
      option.style.cursor = 'pointer';
      option.style.hover = 'backgroundColor: #000080; color: white';

      option.addEventListener('mouseover', () => {
        option.style.backgroundColor = '#000080';
        option.style.color = 'white';
      });

      option.addEventListener('mouseout', () => {
        option.style.backgroundColor = '';
        option.style.color = '';
      });

      option.addEventListener('click', () => {

        const trackSrc = track.getAttribute('data-src');
        if (!playlist.tracks.includes(trackSrc)) {
          playlist.tracks.push(trackSrc);

          const transaction = db.transaction(['playlists'], 'readwrite');
          const store = transaction.objectStore('playlists');
          const request = store.put(playlist);
          request.onsuccess = () => {
            const playlistIndex = playlists.findIndex(p => p.name === playlist.name);
            if (playlistIndex !== -1) {
              playlists[playlistIndex] = playlist;
            }

            if (currentPlaylist && currentPlaylist.name === playlist.name) {
              renderPlaylistTracks(currentPlaylist);
            }
            dialog.show(`Added track to "${playlist.name}" playlist`);
          };
          request.onerror = (event) => {
            dialog.show('Failed to add track to playlist: ' + event.target.error);
          };
        } else {
          dialog.show(`Track already exists in "${playlist.name}" playlist`);
        }

        contextMenu.remove();
      });

      contextMenu.appendChild(option);
    });
  }

  document.body.appendChild(contextMenu);

  document.addEventListener('click', function closeMenu(e) {
    if (!contextMenu.contains(e.target)) {
      contextMenu.remove();
      document.removeEventListener('click', closeMenu);
    }
  });
}

document.querySelectorAll('.track').forEach(track => {
  track.addEventListener('click', trackHandler);
  track.addEventListener('contextmenu', trackHandler);
});

document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.track') || e.target.closest('.media-item')) {
    e.preventDefault();
  }
});

document.getElementById('uploadBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(addTrackToList);
  e.target.value = '';
});

document.querySelectorAll('.track').forEach(track => {
    track.addEventListener('click', () => {
        currentTrack = track.getAttribute('data-src');
        audio.src = currentTrack;
        document.querySelectorAll('.track').forEach(t => t.classList.remove('active'));
        track.classList.add('active');
        audio.play();
        document.getElementById('playBtn').textContent = '⏸ Pause';
    });
});

document.getElementById('playBtn').addEventListener('click', () => {
    if(audio.paused) {
        audio.play();

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        document.getElementById('playBtn').textContent = '⏸ Pause';
    } else {
        audio.pause();
        document.getElementById('playBtn').textContent = '▶ Play';
    }
});

document.getElementById('stopBtn').addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    document.getElementById('playBtn').textContent = '▶ Play';
    document.querySelectorAll('.track').forEach(t => t.classList.remove('active'));
});

document.getElementById('loopBtn').addEventListener('click', () => {
    isLooping = !isLooping;
    audio.loop = isLooping;
    const loopBtn = document.getElementById('loopBtn');
    if (isLooping) {
        loopBtn.style.backgroundColor = '#808080';
        loopBtn.style.borderColor = '#404040 #ffffff #ffffff #404040';
    } else {
        loopBtn.style.backgroundColor = '#c0c0c0';
        loopBtn.style.borderColor = '#ffffff #808080 #808080 #ffffff';
    }
});

audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    document.querySelector('.progress-bar').style.width = progress + '%';
});

audio.addEventListener('ended', () => {
    if (!isLooping) {
        if (currentPlaylist) {

            const playlistTracks = Array.from(document.querySelectorAll('.playlist-track'));
            const currentIndex = playlistTracks.findIndex(t => t.classList.contains('active'));

            if (currentIndex > -1 && currentIndex < playlistTracks.length - 1) {
                playlistTracks[currentIndex + 1].click();
            }
        } else {

            const tracks = Array.from(document.querySelectorAll('.track'));
            const currentIndex = tracks.findIndex(t => t.classList.contains('active'));

            if (currentIndex > -1 && currentIndex < tracks.length - 1) {
                tracks[currentIndex + 1].click();
            }
        }
    }
});

function renderPlaylists() {
  const playlistList = document.querySelector('.playlist-list');
  playlistList.innerHTML = '';

  playlists.forEach((playlist, index) => {
    const playlistItem = document.createElement('div');
    playlistItem.className = 'playlist-item';
    playlistItem.textContent = playlist.name;
    playlistItem.dataset.index = index;

    playlistItem.addEventListener('click', () => {
      document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('active'));
      playlistItem.classList.add('active');
      currentPlaylist = playlist;
      renderPlaylistTracks(playlist);
    });

    playlistList.appendChild(playlistItem);
  });
}

function renderPlaylistTracks(playlist) {
  const playlistTracks = document.querySelector('.playlist-tracks');
  playlistTracks.innerHTML = '';

  if (!db) return;
  const transaction = db.transaction(['tracks'], 'readonly');
  const store = transaction.objectStore('tracks');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = () => {
    const allTracks = getAllRequest.result;
    playlist.tracks.forEach((trackId, index) => {
      const trackData = allTracks.find(t => t.dataURL === trackId);
      if (trackData) {
        const trackItem = document.createElement('div');
        trackItem.className = 'playlist-track';
        trackItem.dataset.src = trackData.dataURL;
        trackItem.dataset.index = index;

        const thumbnail = document.createElement('img');
        thumbnail.className = 'media-thumbnail';
        thumbnail.src = trackData.type.startsWith('audio/') ? 'icons/music-note.png' : 'icons/video-thumbnail.png';

        const title = document.createElement('span');
        title.className = 'media-title';
        title.textContent = trackData.name.replace(/\.[^/.]+$/, '');

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-track-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from playlist';
        removeBtn.style.marginLeft = 'auto';
        removeBtn.style.background = '#c0c0c0';
        removeBtn.style.border = '1px solid #808080';
        removeBtn.style.borderRadius = '0px';
        removeBtn.style.width = '20px';
        removeBtn.style.height = '20px';
        removeBtn.style.cursor = 'pointer';

        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          playlist.tracks.splice(index, 1);
          const transaction = db.transaction(['playlists'], 'readwrite');
          const store = transaction.objectStore('playlists');
          const request = store.put(playlist);
          request.onsuccess = () => {
            const playlistIndex = playlists.findIndex(p => p.name === playlist.name);
            if (playlistIndex !== -1) {
              playlists[playlistIndex] = playlist;
            }
          };
          request.onerror = (event) => {
            console.error('Error updating playlist:', event.target.error);
          };
          renderPlaylistTracks(playlist);
        });

        trackItem.appendChild(thumbnail);
        trackItem.appendChild(title);
        trackItem.appendChild(removeBtn);

        trackItem.addEventListener('click', () => {
          const newTrackSrc = trackData.dataURL;

          if (crossfadeTime > 0 && audio.duration && !audio.paused && currentTrack !== newTrackSrc) {
            crossfadeToTrack(newTrackSrc);
          } else {
            audio.src = newTrackSrc;
            audio.play();
          }

          currentTrack = newTrackSrc;
          document.querySelectorAll('.playlist-track').forEach(t => t.classList.remove('active'));
          trackItem.classList.add('active');
          document.getElementById('playBtn').textContent = '⏸ Pause';

          if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
          }
        });

        playlistTracks.appendChild(trackItem);
      }
    });
  };
}

document.getElementById('createPlaylistBtn').addEventListener('click', () => {
  const playlistName = document.getElementById('playlistNameInput').value.trim();
  if (playlistName) {
    const newPlaylist = {
      name: playlistName,
      tracks: []
    };

    const transaction = db.transaction(['playlists'], 'readwrite');
    const store = transaction.objectStore('playlists');
    const request = store.add(newPlaylist);

    request.onsuccess = () => {
      playlists.push(newPlaylist);
      document.getElementById('playlistNameInput').value = '';
      renderPlaylists();

      const playlistItems = document.querySelectorAll('.playlist-item');
      playlistItems[playlistItems.length - 1].click();
    };

    request.onerror = (event) => {
      console.error('Error creating playlist:', event.target.error);
    };
  }
});

function addSelectedTracksToPlaylist() {
  if (currentPlaylist) {

    const selectedTracks = Array.from(document.querySelectorAll('.track.active'));

    if (selectedTracks.length > 0) {
      let addedCount = 0;
      selectedTracks.forEach(track => {
        const trackSrc = track.getAttribute('data-src');
        if (!currentPlaylist.tracks.includes(trackSrc)) {
          currentPlaylist.tracks.push(trackSrc);
          addedCount++;
        }
      });

      const playlistIndex = playlists.findIndex(p => p.name === currentPlaylist.name);
      if (playlistIndex !== -1) {
        playlists[playlistIndex] = currentPlaylist;
      }

      localStorage.setItem('playlists', JSON.stringify(playlists));

      renderPlaylistTracks(currentPlaylist);

      if (addedCount > 0) {
        dialog.show(`Added ${addedCount} track(s) to "${currentPlaylist.name}" playlist`);
      } else {
        dialog.show('All selected tracks are already in the playlist');
      }
    } else {
      dialog.show('Please select at least one track to add to the playlist');
    }
  } else {
    dialog.show('Please select a playlist first');
  }
}

document.getElementById('savePlaylistBtn').addEventListener('click', addSelectedTracksToPlaylist);

document.getElementById('addToPlaylistBtn').addEventListener('click', (e) => {

  const selectedTracks = Array.from(document.querySelectorAll('.track.active'));

  if (selectedTracks.length === 0) {
    dialog.show('Please select at least one track to add to a playlist');
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'playlist-dropdown';
  dropdown.style.position = 'absolute';
  dropdown.style.left = `${e.clientX}px`;
  dropdown.style.top = `${e.clientY}px`;
  dropdown.style.backgroundColor = '#c0c0c0';
  dropdown.style.border = '2px outset #fff';
  dropdown.style.padding = '2px';
  dropdown.style.zIndex = '1000';
  dropdown.style.minWidth = '150px';

  const header = document.createElement('div');
  header.textContent = 'Select Playlist:';
  header.style.padding = '4px';
  header.style.borderBottom = '1px solid #808080';
  header.style.fontWeight = 'bold';
  dropdown.appendChild(header);

  if (playlists.length === 0) {
    const noPlaylists = document.createElement('div');
    noPlaylists.textContent = 'No playlists available';
    noPlaylists.style.padding = '4px';
    dropdown.appendChild(noPlaylists);
  } else {
    playlists.forEach(playlist => {
      const option = document.createElement('div');
      option.textContent = playlist.name;
      option.style.padding = '4px';
      option.style.cursor = 'pointer';

      option.addEventListener('mouseover', () => {
        option.style.backgroundColor = '#000080';
        option.style.color = 'white';
      });

      option.addEventListener('mouseout', () => {
        option.style.backgroundColor = '';
        option.style.color = '';
      });

      option.addEventListener('click', () => {

        currentPlaylist = playlist;

        document.querySelectorAll('.playlist-item').forEach(item => {
          item.classList.remove('active');
          if (item.textContent === playlist.name) {
            item.classList.add('active');
          }
        });

        addSelectedTracksToPlaylist();

        dropdown.remove();
      });

      dropdown.appendChild(option);
    });
  }

  document.body.appendChild(dropdown);

  document.addEventListener('click', function closeDropdown(e) {
    if (!dropdown.contains(e.target) && e.target !== document.getElementById('addToPlaylistBtn')) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  });
});

let ctrlPressed = false;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    ctrlPressed = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') {
    ctrlPressed = false;
  }
});

const originalTrackHandler = trackHandler;
trackHandler = (event) => {
  const track = event.currentTarget;

  if (ctrlPressed) {

    track.classList.toggle('active');
  } else {

    currentTrack = track.getAttribute('data-src');
    audio.src = currentTrack;
    if (!ctrlPressed) {
      document.querySelectorAll('.track').forEach(t => t.classList.remove('active'));
    }
    track.classList.add('active');
    audio.play();
    document.getElementById('playBtn').textContent = '⏸ Pause';
  }
};

function showTrackContextMenu(event, track) {

  const existingMenu = document.querySelector('.context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.backgroundColor = '#c0c0c0';
  contextMenu.style.border = '2px outset #fff';
  contextMenu.style.padding = '2px';
  contextMenu.style.zIndex = '1000';

  const renameOption = document.createElement('div');
  renameOption.textContent = 'Rename';
  renameOption.style.padding = '4px';
  renameOption.style.cursor = 'pointer';
  renameOption.addEventListener('mouseover', () => {
    renameOption.style.backgroundColor = '#000080';
    renameOption.style.color = 'white';
  });
  renameOption.addEventListener('mouseout', () => {
    renameOption.style.backgroundColor = '';
    renameOption.style.color = '';
  });
  renameOption.addEventListener('click', () => {
    const trackSrc = track.getAttribute('data-src');
    const newName = prompt('Enter new track name:');
    if (newName && db) {
      const transaction = db.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const getRequest = store.get(trackSrc);
      getRequest.onsuccess = () => {
        const trackData = getRequest.result;
        if (trackData) {
          trackData.name = newName;
          const putRequest = store.put(trackData);
          putRequest.onsuccess = () => {
            loadTracks();

            if (currentPlaylist) renderPlaylistTracks(currentPlaylist);
          };
        }
      };
    }
    contextMenu.remove();
  });
  contextMenu.appendChild(renameOption);

  const deleteOption = document.createElement('div');
  deleteOption.textContent = 'Delete';
  deleteOption.style.padding = '4px';
  deleteOption.style.cursor = 'pointer';
  deleteOption.addEventListener('mouseover', () => {
    deleteOption.style.backgroundColor = '#800000';
    deleteOption.style.color = 'white';
  });
  deleteOption.addEventListener('mouseout', () => {
    deleteOption.style.backgroundColor = '';
    deleteOption.style.color = '';
  });
  deleteOption.addEventListener('click', () => {
    const trackSrc = track.getAttribute('data-src');
    if (confirm('Are you sure you want to delete this track?')) {
      if (db) {
        const transaction = db.transaction(['tracks', 'playlists'], 'readwrite');
        const trackStore = transaction.objectStore('tracks');
        const playlistStore = transaction.objectStore('playlists');
        const deleteRequest = trackStore.delete(trackSrc);
        deleteRequest.onsuccess = () => {

          playlistStore.getAll().onsuccess = function(e) {
            const allPlaylists = e.target.result;
            let changed = false;
            allPlaylists.forEach(pl => {
              const idx = pl.tracks.indexOf(trackSrc);
              if (idx !== -1) {
                pl.tracks.splice(idx, 1);
                playlistStore.put(pl);
                changed = true;
              }
            });
            if (changed) {
              loadPlaylists();
              if (currentPlaylist) renderPlaylistTracks(currentPlaylist);
            }
          };
          loadTracks();
        };
      }
    }
    contextMenu.remove();
  });
  contextMenu.appendChild(deleteOption);

  document.body.appendChild(contextMenu);

  document.addEventListener('click', function closeMenu(e) {
    if (!contextMenu.contains(e.target)) {
      contextMenu.remove();
      document.removeEventListener('click', closeMenu);
    }
  });
}

document.querySelector('.track-list').addEventListener('contextmenu', function(e) {
  const track = e.target.closest('.track');
  if (track) {
    e.preventDefault();
    showTrackContextMenu(e, track);
  }
});
