const startupSound = new Audio();
const primarySource = 'https://www.winhistory.de/more/winstart/mp3/win95.mp3';
const fallbackSource = 'https://www.myinstants.com/media/sounds/windows-95-startup.mp3';

startupSound.addEventListener('error', (e) => {
    console.error('Error loading primary startup sound:', e);
    if (startupSound.src === primarySource) {
        console.log('Trying fallback source...');
        startupSound.src = fallbackSource;
        startupSound.load();
    } else {
        const dialog = new Win95Dialog();
        dialog.show('Failed to load startup sound. Check your audio settings.');
    }
});

startupSound.src = primarySource;
startupSound.load();

class Win95Dialog {
    constructor() {

        this.overlay = document.createElement('div');
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100%';
        this.overlay.style.height = '100%';
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.overlay.style.zIndex = '9998';
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);

        this.overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        this.dialog = document.createElement('div');
        this.dialog.className = 'window dialog';
        this.dialog.style.position = 'fixed';
        this.dialog.style.zIndex = '9999';
        this.dialog.style.display = 'none';
        this.dialog.innerHTML = `
            <div class="title-bar">
                <span class="title-text" id="dialog-title">WinTrack95</span>
                <div class="window-controls">
                    <button class="control-btn" aria-label="Close dialog">×</button>
                </div>
            </div>
            <div class="content dialog-content" role="alertdialog" aria-labelledby="dialog-title">
                <div class="dialog-message" role="alert"></div>
                <div class="dialog-buttons">
                    <button class="btn dialog-btn" autofocus>OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.dialog);

        const centerDialog = () => {
            const rect = this.dialog.getBoundingClientRect();
            this.dialog.style.left = `${(window.innerWidth - rect.width) / 2}px`;
            this.dialog.style.top = `${(window.innerHeight - rect.height) / 3}px`;
        };

        this.dialog.querySelector('.control-btn').addEventListener('click', () => {
            this.hide();
        });

        this.dialog.querySelector('.dialog-btn').addEventListener('click', () => {
            this.hide();
        });

        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        this.dialog.querySelector('.title-bar').addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - this.dialog.offsetLeft;
            initialY = e.clientY - this.dialog.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                this.dialog.style.left = `${currentX}px`;
                this.dialog.style.top = `${currentY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        window.addEventListener('resize', centerDialog);
    }

    show(message) {
        this.dialog.querySelector('.dialog-message').textContent = message;
        this.dialog.style.display = 'block';
        this.overlay.style.display = 'block';

        const rect = this.dialog.getBoundingClientRect();
        this.dialog.style.left = `${(window.innerWidth - rect.width) / 2}px`;
        this.dialog.style.top = `${(window.innerHeight - rect.height) / 3}px`;
    }

    hide() {
        this.dialog.style.display = 'none';
        this.overlay.style.display = 'none';
    }
}

export { Win95Dialog, startupSound };