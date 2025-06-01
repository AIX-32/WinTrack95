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

        // Add both click and touch event listeners for better mobile support
        const addWindowControlListeners = (element, handler) => {
            element.addEventListener('click', handler);
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handler(e);
            }, { passive: false });
        };

        addWindowControlListeners(minimizeBtn, () => minimizeWindow(window));
        addWindowControlListeners(maximizeBtn, () => maximizeWindow(window));
        addWindowControlListeners(closeBtn, () => closeWindow(window));

        // Handle title bar double-click/tap for maximize/restore
        const titleBar = window.querySelector('.title-bar');
        let tapCount = 0;
        let tapTimer = null;

        const handleTitleBarTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            tapCount++;
            if (tapCount === 1) {
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                }, 300);
            } else if (tapCount === 2) {
                clearTimeout(tapTimer);
                tapCount = 0;
                maximizeWindow(window);
            }
        };

        titleBar.addEventListener('dblclick', () => maximizeWindow(window));
        titleBar.addEventListener('touchend', handleTitleBarTap, { passive: false });
    });
}

function minimizeWindow(window) {

    const title = window.querySelector('.title-text').textContent;
    const taskbarApp = Array.from(document.querySelectorAll('.app'))
        .find(app => app.textContent === title);

    if (taskbarApp) {
        window.style.display = 'none';
        taskbarApp.classList.add('minimized');

        const showWindow = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.style.display = 'block';
            window.style.zIndex = '10';
            taskbarApp.classList.remove('minimized');
            taskbarApp.removeEventListener('click', showWindow);
            taskbarApp.removeEventListener('touchend', showWindow);
        };

        taskbarApp.addEventListener('click', showWindow);
        taskbarApp.addEventListener('touchend', showWindow, { passive: false });
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
