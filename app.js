class VoiceTaskApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.history = this.loadHistory();
        this.isRecording = false;
        this.recognition = null;
        this.playBeep = null;
        this.editingTaskId = null;

        this.user = this.loadUser();
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAudioContext();
        this.renderTasks();
        this.initializePWA();

        // Expose instance for global callbacks (like Google Auth)
        window.app = this;

        // Initial backup to cloud if logged in
        if (this.user && this.syncUrlInput.value) {
            this.syncToCloud();
        }

        // Instant sync heartbeat (every 10 seconds for background safety)
        setInterval(() => this.syncToCloud(), 10000);
    }

    initializeElements() {
        this.micButton = document.getElementById('micButton');
        this.transcription = document.getElementById('transcription');
        this.transcriptText = document.getElementById('transcriptText');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        this.particles = document.getElementById('particles');
        this.taskList = document.getElementById('taskList');
        this.taskCount = document.getElementById('taskCount');
        this.dateLabel = document.getElementById('dateLabel');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettings = document.getElementById('closeSettings');
        this.syncUrlInput = document.getElementById('syncUrl');
        this.syncStatus = document.getElementById('syncStatus');
        this.forceSyncBtn = document.getElementById('forceSync');
        this.openSettingsBtn = document.getElementById('openSettings');
        this.userProfile = document.getElementById('userProfile');
        this.userAvatar = document.getElementById('userAvatar');
        this.userNameLabel = document.getElementById('userName');
        this.calendarGrid = document.getElementById('calendarGrid');
        this.calendarHeader = document.getElementById('calendarHeader');

        this.loadSettings();

        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.forceSyncBtn.addEventListener('click', () => this.syncToCloud(true));
        if (this.openSettingsBtn) {
            this.openSettingsBtn.addEventListener('click', () => this.toggleSettings(true));
        }
        this.closeSettings.addEventListener('click', () => {
            this.saveSettings();
            this.toggleSettings(false);
        });

        // Settings interactivity
        document.querySelectorAll('.settings-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                this.playPing && this.playPing();
            });
        });

        // Close modal on click outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.saveSettings();
                this.toggleSettings(false);
            }
        });

        // Sync URL live saving (Crucial for iOS PWA persistence)
        this.syncUrlInput.addEventListener('input', () => {
            this.updateSyncStatus();
            this.saveSettings();
        });

        // Calendar Listeners
        this.openCalendar = document.getElementById('openCalendar');
        this.calendarModal = document.getElementById('calendarModal');
        this.closeCalendar = document.getElementById('closeCalendar');
        this.calendarGrid = document.getElementById('calendarGrid');

        this.openCalendar.addEventListener('click', () => {
            this.renderCalendar();
            this.calendarModal.classList.add('show');
        });
        this.closeCalendar.addEventListener('click', () => {
            this.calendarModal.classList.remove('show');
        });

        this.createParticles();
        this.updateDateLabel();
        this.bars = Array.from(this.micButton.querySelectorAll('.bar'));
        this.audioStream = null;
        this.visualizerId = null;
    }

    createParticles() {
        if (!this.particles) return;
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (15 + Math.random() * 10) + 's';
            this.particles.appendChild(particle);
        }
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createBeepSound();
        } catch (error) {
            console.log('Audio context not available');
        }
    }

    createBeepSound() {
        if (!this.audioContext) return;

        this.playPing = () => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.2);
        };

        this.playPop = () => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, this.audioContext.currentTime);
            osc.frequency.linearRampToValueAtTime(110, this.audioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.1);
        };
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showToast('Speech recognition is not supported in your browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateRecordingUI(true);
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            this.transcriptText.textContent = transcript;
            this.transcription.classList.add('show');

            if (event.results[0].isFinal) {
                this.processVoiceCommand(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                this.stopRecording();
                return;
            }
            console.error('Speech recognition error:', event.error);
            this.showToast(`Error: ${event.error}`);
            this.stopRecording();
        };

        this.recognition.onend = () => {
            this.stopRecording();
        };
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (this.recognition) {
            this.recognition.start();
            this.startVisualizer();
        }
    }

    async startVisualizer() {
        try {
            if (!this.audioContext) await this.initializeAudioContext();
            if (this.audioContext.state === 'suspended') await this.audioContext.resume();

            // accuracy speed is important - high-performance visualizer
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64; // Small fft for fast response
            this.analyser.smoothingTimeConstant = 0.8; // Softer, more fluid animation
            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                if (!this.isRecording) return;
                this.visualizerId = requestAnimationFrame(draw);

                this.analyser.getByteFrequencyData(dataArray);

                // Average all frequency data for unified animation
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const intensity = sum / (bufferLength * 255);

                const baseHeights = [8, 12, 18, 12, 8];
                for (let i = 0; i < this.bars.length; i++) {
                    const bar = this.bars[i];
                    const height = baseHeights[i] + (intensity * 16);
                    bar.style.height = `${height}px`;
                    bar.style.background = '#000000';
                    bar.style.opacity = 0.85 + (intensity * 0.15);
                }
            };
            draw();
        } catch (err) {
            console.error('Mic Visualizer failed:', err);
        }
    }

    stopRecording(immediate = false) {
        this.isRecording = false;
        this.updateRecordingUI(false);

        if (this.visualizerId) {
            cancelAnimationFrame(this.visualizerId);
            this.visualizerId = null;
        }

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Reset bars to default state
        if (this.bars) {
            const defaults = [6, 10, 16, 10, 6];
            this.bars.forEach((bar, i) => {
                bar.style.height = `${defaults[i]}px`;
                bar.style.background = '';
                bar.style.opacity = '';
            });
        }

        if (this.recognition) {
            this.recognition.stop();
        }

        const delay = immediate ? 0 : 400;
        setTimeout(() => {
            this.transcription.classList.remove('show');
            this.transcriptText.textContent = '';
            // Reset editing state if it was active but not handled
            if (this.editingTaskId && !immediate) {
                this.editingTaskId = null;
                this.renderTasks();
            }
        }, delay);
    }

    toggleSettings(show) {
        if (show) {
            this.settingsModal.classList.add('show');
            this.showToast('Settings opened');
        } else {
            this.settingsModal.classList.remove('show');
        }
    }

    updateRecordingUI(recording) {
        if (recording) {
            this.micButton.classList.add('recording');
            document.body.classList.add('recording-mode');
        } else {
            this.micButton.classList.remove('recording');
            document.body.classList.remove('recording-mode');
        }
    }

    processVoiceCommand(transcript) {
        const text = transcript.toLowerCase().trim();

        // Resume Audio Context (iOS Policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Handle Edit/Re-dictation if active
        if (this.editingTaskId) {
            const id = this.editingTaskId;
            this.editingTaskId = null;
            this.updateTaskText(id, transcript);
            return;
        }

        // Common commands
        if (text.includes('settings') || text.includes('config')) {
            this.toggleSettings(true);
            return;
        }

        // Type Intelligence (Task / Notification / Event)
        let type = 'task';
        let finalContent = text;

        // Date/Time keywords with word boundaries to avoid partial matches (e.g., 'am' in 'Amazon')
        const dateKeywords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'morning', 'afternoon', 'evening', 'night', 'tonight', 'pm', 'am'];

        const hasDateKeyword = dateKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text));
        const hasTimePattern = /\b(at|around|by)\s+\d{1,2}(:\d{2})?\b/i.test(text);
        const hasNumericalDate = /\b\d{1,2}(\/|-)\d{1,2}\b/.test(text);

        if (text.startsWith('remind me') || text.startsWith('notification') || text.startsWith('alert') || text.startsWith('remember')) {
            type = 'notification';
            finalContent = text.replace('remind me', '').replace('notification', '').replace('alert', '').replace('remember', '').trim();
        } else if (text.startsWith('event') || text.startsWith('calendar')) {
            type = 'event';
            finalContent = text.replace('event', '').replace('calendar', '').trim();
        } else if (hasDateKeyword || hasTimePattern || hasNumericalDate) {
            type = 'event';
        }

        // Syncing with user preference: if they said "note", treat as task or notification
        if (text.startsWith('note')) {
            finalContent = text.replace('note', '').trim();
        }

        if (finalContent.length > 0) {
            this.addTask(finalContent, type);
        }
    }

    addTask(text, type = 'task') {
        const task = {
            id: Date.now(),
            text: text,
            type: type,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.logHistory('CREATED', task);
        this.saveTasks();
        this.renderTasks();
        this.triggerSuccessAnimation();
    }

    triggerSuccessAnimation() {
        if (!this.micButton) return;
        this.micButton.classList.add('success');
        setTimeout(() => {
            this.micButton.classList.remove('success');
        }, 1500);
    }

    editTask(id) {
        this.editingTaskId = id;
        this.renderTasks(); // Highlight editing state
        this.startRecording();
        this.showToast('Listening to update...');
    }

    updateTaskText(id, newText) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            const oldText = task.text;
            task.text = newText;
            this.logHistory('EDITED', task, `From: "${oldText}"`);
            this.saveTasks();
            this.renderTasks();
            this.triggerSuccessAnimation();
        }
    }

    showToast(message) {
        if (!this.toastMessage || !this.toast) return;
        this.toastMessage.textContent = message;
        this.toast.classList.add('show');

        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    saveTasks() {
        localStorage.setItem('voiceTasks', JSON.stringify(this.tasks));
        localStorage.setItem('doneHistory', JSON.stringify(this.history));
        this.syncToCloud();
    }

    logHistory(action, task, details = '') {
        const entry = {
            timestamp: new Date().toISOString(),
            action: action,
            taskId: task.id,
            text: task.text,
            type: task.type || 'task',
            details: details
        };
        this.history.unshift(entry);
        if (this.history.length > 200) this.history.pop(); // Keep manageable
    }

    async syncToCloud(isManual = false) {
        const url = this.syncUrlInput.value.trim();
        const isEnabled = document.getElementById('toggle-sync').classList.contains('active');

        if (!url || (!isEnabled && !isManual)) return;

        if (!url.includes('/macros/s/') || !url.includes('/exec')) {
            this.syncStatus.textContent = isManual ? 'Invalid URL' : 'Ready';
            return;
        }

        this.syncStatus.textContent = isManual ? 'Backing up...' : 'Cloud Active';

        try {
            // DIRECT PUSH: Single device focus, simply upload current state
            const params = new URLSearchParams();
            params.append('payload', JSON.stringify({
                tasks: this.tasks,
                history: this.history
            }));

            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                body: params
            });

            this.syncStatus.textContent = 'Synced';
            this.syncStatus.style.color = '#4ade80';
            if (isManual) this.showToast('Cloud backup complete!');

        } catch (error) {
            console.error('Backup failed:', error);
            this.syncStatus.textContent = 'Backup paused';
            this.syncStatus.style.color = '#f87171';
        }
    }

    saveSettings() {
        const url = this.syncUrlInput.value.trim();
        const isEnabled = document.getElementById('toggle-sync').classList.contains('active');

        localStorage.setItem('doneSettings', JSON.stringify({
            syncUrl: url,
            syncEnabled: isEnabled,
            user: this.user
        }));

        this.updateSyncStatus();
    }

    updateSyncStatus() {
        const url = this.syncUrlInput.value.trim();
        const isEnabled = document.getElementById('toggle-sync').classList.contains('active');

        if (!url) {
            this.syncStatus.textContent = 'Enter URL to start';
            this.syncStatus.style.color = 'rgba(255,255,255,0.4)';
        } else if (!isEnabled) {
            this.syncStatus.textContent = 'Sync is paused';
            this.syncStatus.style.color = '#f87171';
        } else {
            this.syncStatus.textContent = 'Ready for Cloud';
            this.syncStatus.style.color = '#4ade80';
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('doneSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.syncUrlInput.value = settings.syncUrl || '';
            const toggle = document.getElementById('toggle-sync');
            if (settings.syncEnabled) {
                toggle.classList.add('active');
            }
            this.user = settings.user || null;
            if (this.user) this.updateUserUI();
        }
        this.updateSyncStatus();
    }

    updateUserUI() {
        if (!this.user) return;
        if (this.userProfile) this.userProfile.style.display = 'flex';
        const signinBtn = document.querySelector('.g_id_signin');
        if (signinBtn) signinBtn.style.display = 'none';
        if (this.userAvatar) this.userAvatar.src = this.user.picture;
        if (this.userNameLabel) this.userNameLabel.textContent = this.user.name;
    }

    handleGoogleSignIn(response) {
        try {
            // Decode the JWT (base64)
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            this.user = JSON.parse(jsonPayload);
            this.saveSettings();
            this.updateUserUI();
            this.showToast(`Logged in as ${this.user.name}`);
        } catch (e) {
            console.error('Login failed', e);
            this.showToast('Login failed');
        }
    }

    loadUser() {
        const saved = localStorage.getItem('doneSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.user || null;
        }
        return null;
    }

    loadTasks() {
        const saved = localStorage.getItem('voiceTasks');
        return saved ? JSON.parse(saved) : [];
    }

    loadHistory() {
        const saved = localStorage.getItem('doneHistory');
        return saved ? JSON.parse(saved) : [];
    }

    updateDateLabel() {
        if (!this.dateLabel) return;
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        this.dateLabel.textContent = now.toLocaleDateString(undefined, options);
    }

    formatRelativeDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }

    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.completed = !task.completed;
        const action = task.completed ? 'COMPLETED' : 'REOPENED';
        this.logHistory(action, task);
        this.saveTasks();
        this.renderTasks();
    }

    deleteTaskById(taskId) {
        const idx = this.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            const deleted = this.tasks.splice(idx, 1)[0];
            this.logHistory('DELETED', deleted);
            this.saveTasks();
            this.renderTasks();
        }
    }

    renderTasks() {
        if (!this.taskList || !this.taskCount) return;

        if (this.tasks.length === 0) {
            this.taskList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">Nothing on your mind.</div>
                    <div class="empty-caption">Tap the mic and just say what you need to remember.</div>
                </div>
            `;
            this.taskCount.textContent = '0';
            return;
        }

        const activeTasks = this.tasks.filter(t => !t.completed);
        const completedTasks = this.tasks.filter(t => t.completed);

        this.taskList.innerHTML = ''; // Clear existing tasks

        if (activeTasks.length > 0) {
            const sectionLabel = document.createElement('div');
            sectionLabel.className = 'section-label';
            sectionLabel.textContent = 'ACTIVE';
            this.taskList.appendChild(sectionLabel);
            activeTasks.forEach(task => {
                this.taskList.appendChild(this.createTaskHTML(task));
            });
        }

        if (completedTasks.length > 0) {
            const sectionLabel = document.createElement('div');
            sectionLabel.className = 'section-label';
            sectionLabel.textContent = 'COMPLETED';
            this.taskList.appendChild(sectionLabel);
            completedTasks.forEach(task => {
                this.taskList.appendChild(this.createTaskHTML(task));
            });
        }

        this.taskCount.textContent = String(activeTasks.length);
    }

    createTaskHTML(task) {
        const div = document.createElement('div');
        const isEditing = this.editingTaskId === task.id;
        const type = task.type || 'task';

        let icon = '';
        if (type === 'notification') {
            icon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> NOTIFICATION`;
        } else if (type === 'event') {
            icon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> EVENT`;
        } else {
            icon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> TASK`;
        }

        div.innerHTML = `
            <article class="task-card ${type} ${task.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}" data-id="${task.id}">
                <input
                    id="task-check-${task.id}"
                    class="task-checkbox"
                    type="checkbox"
                    ${task.completed ? 'checked' : ''}
                    aria-label="Mark task as ${task.completed ? 'active' : 'completed'}"
                />
                <div class="task-main">
                    <div class="type-badge">
                        ${icon}
                    </div>
                    <div class="${task.completed ? 'task-text completed' : 'task-text'}">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">${this.formatRelativeDate(task.createdAt)}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="task-edit" title="Retry / Re-dictate" aria-label="Re-dictate task">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M23 4v6h-6"></path>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                    <button class="task-delete" title="Delete" aria-label="Delete task">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </article>
        `;

        div.querySelector('.task-checkbox').addEventListener('change', () => this.toggleTask(task.id));
        div.querySelector('.task-edit').addEventListener('click', () => this.editTask(task.id));
        div.querySelector('.task-delete').addEventListener('click', () => this.deleteTaskById(task.id));

        return div.firstElementChild;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    initializePWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // fail silently; offline is a bonus
            });
        }
    }

    renderCalendar(selectedDate = new Date()) {
        if (!this.calendarGrid || !this.calendarHeader) return;
        this.calendarGrid.innerHTML = '';
        const dayTasksList = document.getElementById('dayTasksList');
        const dayDetailsTitle = document.getElementById('dayDetailsTitle');

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const now = new Date();

        // Premium Header (e.g. "February 2026")
        const monthName = selectedDate.toLocaleString('default', { month: 'long' });
        this.calendarHeader.innerHTML = `
            <span>${monthName} ${year}</span>
            <div style="display: flex; gap: 10px;">
                <button id="prevMonth" style="background:none; border:none; color:white; cursor:pointer; padding:5px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button id="nextMonth" style="background:none; border:none; color:white; cursor:pointer; padding:5px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        `;

        document.getElementById('prevMonth').onclick = (e) => {
            e.stopPropagation();
            this.renderCalendar(new Date(year, month - 1, 1));
        };
        document.getElementById('nextMonth').onclick = (e) => {
            e.stopPropagation();
            this.renderCalendar(new Date(year, month + 1, 1));
        };

        // Header weekdays
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
            const el = document.createElement('div');
            el.className = 'calendar-weekday';
            el.textContent = day;
            this.calendarGrid.appendChild(el);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty spaces
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day';
            empty.style.opacity = '0';
            this.calendarGrid.appendChild(empty);
        }

        // Actual days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayEl = document.createElement('div');
            const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const tasksOnDay = this.tasks.filter(t => t.createdAt.startsWith(dateStr));

            dayEl.className = `calendar-day ${isToday ? 'today' : ''}`;
            dayEl.innerHTML = `
                <span>${d}</span>
                ${tasksOnDay.length > 0 ? '<div class="calendar-dot"></div>' : ''}
            `;

            dayEl.onclick = () => {
                // Remove previous selection
                document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
                dayEl.classList.add('selected');

                // Update Details
                const displayDate = new Date(year, month, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                dayDetailsTitle.textContent = displayDate;

                dayTasksList.innerHTML = tasksOnDay.length > 0
                    ? tasksOnDay.map(t => {
                        const color = t.type === 'event' ? '#0a84ff' : (t.type === 'notification' ? '#fbbf24' : '#4ade80');
                        return `
                            <div class="day-task-item">
                                <div class="day-task-bullet" style="background: ${color}"></div>
                                <div class="day-task-text">${this.escapeHtml(t.text)}</div>
                            </div>
                        `;
                    }).join('')
                    : '<div style="opacity: 0.3; font-style: italic; padding: 20px; text-align: center;">No tasks for this day</div>';

                if ('vibrate' in navigator) navigator.vibrate(10);
            };

            // Select today by default on first load
            if (isToday) {
                setTimeout(() => dayEl.click(), 0);
            }

            this.calendarGrid.appendChild(dayEl);
        }
    }
}

// Initialize Application
window.addEventListener('load', () => {
    new VoiceTaskApp();
});
