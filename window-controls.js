function initializeWindowControls() {
    const windows = document.querySelectorAll('.window');
    let activeWindow = null;

    windows.forEach(window => {
        const minimizeBtn = window.querySelector('.window-controls .control-btn:nth-child(1)');
        const maximizeBtn = window.querySelector('.window-controls .control-btn:nth-child(2)');
        const closeBtn = window.querySelector('.window-controls .control-btn:nth-child(3)');

        window.dataset.originalWidth = window.style.width;
        window.dataset.originalHeight = window.style.height;
        window.dataset.originalLeft = window.style.left;
        window.dataset.originalTop = window.style.top;

        window.addEventListener('mousedown', () => {
            if (activeWindow && activeWindow !== window) {
                activeWindow.style.zIndex = '1';
            }
            window.style.zIndex = '10';
            activeWindow = window;
        });

        minimizeBtn.addEventListener('click', () => minimizeWindow(window));
        maximizeBtn.addEventListener('click', () => maximizeWindow(window));
        closeBtn.addEventListener('click', () => closeWindow(window));

        window.querySelector('.title-bar').addEventListener('dblclick', () => maximizeWindow(window));
    });
}

function minimizeWindow(window) {

    const title = window.querySelector('.title-text').textContent;
    const taskbarApp = Array.from(document.querySelectorAll('.app'))
        .find(app => app.textContent === title);

    if (taskbarApp) {
        window.style.display = 'none';
        taskbarApp.classList.add('minimized');

        taskbarApp.addEventListener('click', function showWindow() {
            window.style.display = 'block';
            taskbarApp.classList.remove('minimized');
            taskbarApp.removeEventListener('click', showWindow);
        });
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
    window.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', initializeWindowControls);