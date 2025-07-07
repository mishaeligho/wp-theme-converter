// HTML to WordPress Theme Converter - Main JavaScript
console.log('Main JavaScript file loaded');

class ThemeConverter {
    constructor() {
        console.log('ThemeConverter constructor called');
        this.currentStep = 1;
        this.uploadedFiles = new Map();
        this.htmlContent = '';
        this.themeConfig = {};
        this.generatedFiles = new Map();
        this.isConverting = false;
        this.userId = null;
        this.subscribed = false;
        this.uploadedFile = null;

        this.init();
    }

    init() {
        console.log('ThemeConverter init called');
        this.bindEvents();
        this.updateStepDisplay();
        this.checkSubscriptionStatus();
    }

    bindEvents() {
        console.log('bindEvents called');
        // Upload option toggles
        const uploadFileOption = document.getElementById('upload-file-option');
        const uploadHtmlOption = document.getElementById('upload-html-option');

        if (uploadFileOption) {
            uploadFileOption.addEventListener('click', () => {
                this.showUploadOption('file');
            });
        }

        if (uploadHtmlOption) {
            uploadHtmlOption.addEventListener('click', () => {
                this.showUploadOption('html');
            });
        }

        // File upload events
        const fileInput = document.getElementById('file-input');
        const filePicker = document.getElementById('file-picker-btn');
        const uploadZone = document.getElementById('upload-zone');
        const removeFile = document.getElementById('remove-file');

        filePicker.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        removeFile.addEventListener('click', () => this.removeUploadedFile());

        // Download and payment events
        const subscribeBtn = document.getElementById('subscribe-btn');
        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', () => this.startStripeSubscription());
        }
        const downloadBtn = document.getElementById('download-theme');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadTheme());
        }
    }

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            await this.processFile(file);
        }
    }

    async handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-zone').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await this.processFile(files[0]);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-zone').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-zone').classList.remove('dragover');
    }

    async processFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            this.showError('Please upload a ZIP file containing your HTML website.');
            return;
        }
        this.showUploadProgress();
        try {
            // Client-side validation (optional, can be removed for large files)
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);
            let hasIndex = false;
            const files = Object.keys(zipContent.files);
            for (let filename of files) {
                if (filename.toLowerCase().includes('index.html') && !zipContent.files[filename].dir) {
                    hasIndex = true;
                    break;
                }
            }
            if (!hasIndex) {
                this.showError('ZIP file must contain an index.html file.');
                this.hideUploadProgress();
                return;
            }
            // Upload to backend
            await this.uploadToBackend(file);
        } catch (error) {
            console.error('Error processing ZIP file:', error);
            this.showError('Error reading ZIP file. Please ensure it\'s a valid ZIP archive.');
            this.hideUploadProgress();
        }
    }

    async uploadToBackend(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                this.userId = data.user_id;
                this.uploadedFile = file;
                this.showFileInfo(file);
                this.showSubscribeButton();
            } else {
                this.showError(data.error || 'Upload failed.');
                this.hideUploadProgress();
            }
        } catch (err) {
            this.showError('Upload failed. Please try again.');
            this.hideUploadProgress();
        }
    }

    showUploadProgress() {
        document.getElementById('upload-zone').style.display = 'none';
        document.getElementById('upload-progress').style.display = 'block';
        // Animate progress
        const progressFill = document.querySelector('.progress-fill');
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            progressFill.style.width = progress + '%';
        }, 100);
    }

    hideUploadProgress() {
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('upload-zone').style.display = 'block';
    }

    showFileInfo(file) {
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('file-info').style.display = 'block';
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = this.formatFileSize(file.size);
        this.displayFileStructure();
    }

    showSubscribeButton() {
        document.getElementById('subscribe-section').style.display = 'block';
        document.getElementById('download-section').style.display = 'none';
    }

    showDownloadButton() {
        document.getElementById('subscribe-section').style.display = 'none';
        document.getElementById('download-section').style.display = 'block';
    }

    async startStripeSubscription() {
        // Call backend to create Stripe checkout session
        try {
            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                this.showError('Failed to start Stripe checkout.');
            }
        } catch (err) {
            this.showError('Failed to start Stripe checkout.');
        }
    }

    async checkSubscriptionStatus() {
        try {
            const res = await fetch('/api/subscription-status', {
                method: 'GET',
                credentials: 'include'
            });
            const data = await res.json();
            this.subscribed = data.subscribed;
            if (this.subscribed) {
                this.showDownloadButton();
            } else {
                this.showSubscribeButton();
            }
        } catch (err) {
            this.showSubscribeButton();
        }
    }

    async downloadTheme() {
        if (!this.subscribed) {
            this.showError('You must subscribe to download the theme.');
            return;
        }
        window.location.href = '/api/download';
    }

    showError(msg) {
        alert(msg);
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    displayFileStructure() {
        // ... (existing logic)
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.themeConverter = new ThemeConverter();
});
