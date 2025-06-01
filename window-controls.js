// Track windows and their associated taskbar buttons
const windowMap = new Map();
let activeWindow = null;

function initializeWindowControls() {
    const windows = document.querySelectorAll('.window');
    const taskbarButtons = document.querySelectorAll('.app');

    // First, set up taskbar buttons
    taskbarButtons.forEach(button => {
        const windowId = button.getAttribute('data-window');
        if (windowId) {
            const window = document.getElementById(windowId);
            if (window) {
                windowMap.set(button, window);
                
                // Add click handler to taskbar button
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleWindow(window, button);
                });
                
                // Initialize window state
                window.style.display = 'none';
            }
        }
    });

    // Then set up windows
    windows.forEach((window, index) => {
        const title = window.querySelector('.title-text').textContent;

        const minimizeBtn = window.querySelector('.window-controls .control-btn:nth-child(1)');
        const maximizeBtn = window.querySelector('.window-controls .control-btn:nth-child(2)');
        const closeBtn = window.querySelector('.window-controls .control-btn:nth-child(3)');

        window.dataset.originalWidth = window.style.width || '300px';
        window.dataset.originalHeight = window.style.height || '200px';
        window.dataset.originalLeft = window.style.left || '30px';
        window.dataset.originalTop = window.style.top || (30 + (index * 30)) + 'px';

        window.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (activeWindow && activeWindow !== window) {
                activeWindow.style.zIndex = '1';
            }
            window.style.zIndex = '10';
            activeWindow = window;
        });

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            minimizeWindow(window);
        });
        
        maximizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            maximizeWindow(window);
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeWindow(window);
        });

        const titleBar = window.querySelector('.title-bar');
        if (titleBar) {
            titleBar.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                maximizeWindow(window);
            });
        }
    });
}

function toggleWindow(window, taskbarButton) {
    if (window.style.display === 'none') {
        // Show window
        window.style.display = 'block';
        window.style.zIndex = '10';
        if (taskbarButton) {
            taskbarButton.classList.remove('minimized');
        }
        
        // Bring to front
        if (activeWindow) {
            activeWindow.style.zIndex = '1';
        }
        window.style.zIndex = '100';
        activeWindow = window;
        
        // Ensure window is visible
        window.style.visibility = 'visible';
    } else {
        // Hide window
        window.style.display = 'none';
        if (taskbarButton) {
            taskbarButton.classList.add('minimized');
        }
    }
}

function minimizeWindow(window) {
    const title = window.querySelector('.title-text').textContent;
    const taskbarApp = Array.from(document.querySelectorAll('.app')).find(
        app => app.textContent === title || windowMap.get(app) === window
    );

    if (taskbarApp) {
        window.style.display = 'none';
        taskbarApp.classList.add('minimized');
    }
}

function maximizeWindow(window) {
    if (!window.dataset.isMaximized) {

        window.dataset.originalWidth = window.style.width;
        window.dataset.originalHeight = window.style.height;
        window.dataset.originalLeft = window.style.left;
        window.dataset.originalTop = window.style.top;

        const taskbar = document.getElementById('taskbar');
        const taskbarHeight = taskbar ? taskbar.offsetHeight : 30;

        window.style.transition = 'all 0.2s ease';
        window.style.width = '100%';
        window.style.height = `calc(100vh - ${taskbarHeight + 20}px)`;
        window.style.left = '0';
        window.style.top = '0';
        window.dataset.isMaximized = 'true';

        setTimeout(() => {
            window.style.transition = '';
        }, 200);
    } else {

        window.style.transition = 'all 0.2s ease';
        window.style.width = window.dataset.originalWidth;
        window.style.height = window.dataset.originalHeight;
        window.style.left = window.dataset.originalLeft;
        window.style.top = window.dataset.originalTop;
        window.dataset.isMaximized = '';

        setTimeout(() => {
            window.style.transition = '';
        }, 200);
    }
}

function closeWindow(window) {
    const title = window.querySelector('.title-text').textContent;
    const taskbarApp = Array.from(document.querySelectorAll('.app')).find(
        app => app.textContent === title || windowMap.get(app) === window
    );
    
    if (taskbarApp) {
        taskbarApp.classList.remove('minimized');
        taskbarApp.style.display = 'block';
    }
    
    window.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', initializeWindowControls);
