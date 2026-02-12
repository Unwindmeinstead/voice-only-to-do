class VoiceTaskApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.history = this.loadHistory();
        this.isRecording = false;
        this.recognition = null;
        this.playBeep = null;
        this.editingTaskId = null;

        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAudioContext();
        this.renderTasks();
        this.initializePWA();

        // Start background heart-beat sync (every 60 seconds)
        setInterval(() => this.syncToCloud(), 60000);
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

        this.loadSettings();

        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.forceSyncBtn.addEventListener('click', () => this.syncToCloud(true));
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

        // Sync URL live feedback
        this.syncUrlInput.addEventListener('input', () => this.updateSyncStatus());

        this.createParticles();
        this.updateDateLabel();
    }

    createParticles() {
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
            this.playPing && this.playPing();
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
        }
    }

    stopRecording(immediate = false) {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.playPop && this.playPop();

        if (this.recognition) {
            this.recognition.stop();
        }

        const delay = immediate ? 0 : 3000;
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
        } else {
            this.micButton.classList.remove('recording');
        }
    }

    processVoiceCommand(transcript) {
        const text = transcript.toLowerCase().trim();

        // Handle Edit/Re-dictation if active
        if (this.editingTaskId) {
            const id = this.editingTaskId;
            this.editingTaskId = null;
            this.updateTaskText(id, transcript);
            return;
        }

        // Settings (Universal)
        if (text.includes('settings') || text.includes('config')) {
            this.toggleSettings(true);
            return;
        }

        // Action Detection (Complete/Delete)
        const completeKeywords = ['complete', 'done', 'finish', 'check off'];
        for (const kw of completeKeywords) {
            if (text.startsWith(kw)) {
                this.completeTask(text.replace(kw, '').trim());
                return;
            }
        }

        const deleteKeywords = ['delete', 'remove', 'trash', 'remove task'];
        for (const kw of deleteKeywords) {
            if (text.startsWith(kw)) {
                this.deleteTask(text.replace(kw, '').trim());
                return;
            }
        }

        // Type Intelligence (Task/Note/Reminder)
        let type = 'task';
        let finalContent = text;

        if (text.startsWith('remind me to') || text.startsWith('reminder')) {
            type = 'reminder';
            finalContent = text.replace('remind me to', '').replace('reminder', '').trim();
        } else if (text.startsWith('note down') || text.startsWith('take a note') || text.startsWith('note')) {
            type = 'note';
            finalContent = text.replace('note down', '').replace('take a note', '').replace('note', '').trim();
        } else {
            // Clean common add prefixes
            const addPrefixes = ['add task', 'add', 'create', 'new task'];
            for (const pre of addPrefixes) {
                if (text.startsWith(pre)) {
                    finalContent = text.replace(pre, '').trim();
                    break;
                }
            }
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

    completeTask(text) {
        const query = text.toLowerCase();
        const task = this.tasks.find(t => t.text.toLowerCase().includes(query));
        if (task) {
            task.completed = !task.completed;
            this.logHistory(task.completed ? 'COMPLETED' : 'REOPENED', task);
            this.saveTasks();
            this.renderTasks();
            this.showToast(`Task ${task.completed ? 'completed' : 'unmarked'}`);
        }
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

    deleteTask(taskText) {
        const taskIndex = this.tasks.findIndex(t =>
            t.text.toLowerCase().includes(taskText.toLowerCase())
        );

        if (taskIndex !== -1) {
            const deletedTask = this.tasks.splice(taskIndex, 1)[0];
            this.logHistory('DELETED', deletedTask);
            this.saveTasks();
            this.renderTasks();
            this.showToast(`Deleted: ${deletedTask.text}`);
        } else {
            this.showToast(`Not found: ${taskText}`);
        }
    }

    clearCompletedTasks() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        if (completedCount > 0) {
            this.tasks = this.tasks.filter(t => !t.completed);
            this.saveTasks();
            this.renderTasks();
            this.showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`);
        } else {
            this.showToast('No completed tasks to clear');
        }
    }

    showToast(message) {
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

        this.syncStatus.textContent = isManual ? 'Connecting...' : 'Syncing...';
        this.syncStatus.style.color = 'rgba(255,255,255,0.4)';

        try {
            const params = new URLSearchParams();
            params.append('payload', JSON.stringify({
                tasks: this.tasks,
                history: this.history
            }));

            // Background Fire-and-Forget sync
            const request = fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                body: params
            });

            if (isManual) {
                await request;
                this.showToast('Cloud sync complete!');
            }

            this.syncStatus.textContent = 'Cloud Active';
            this.syncStatus.style.color = '#4ade80';
        } catch (error) {
            console.error('Cloud Sync failed:', error);
            this.syncStatus.textContent = 'Sync Paused';
        }
    }

    saveSettings() {
        const url = this.syncUrlInput.value.trim();
        const isEnabled = document.getElementById('toggle-sync').classList.contains('active');

        localStorage.setItem('doneSettings', JSON.stringify({
            syncUrl: url,
            syncEnabled: isEnabled
        }));

        this.updateSyncStatus();
        if (isEnabled && url) {
            this.syncToCloud();
        }
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
        }
        this.updateSyncStatus();
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

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.completed = !task.completed;
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
        if (type === 'note') {
            icon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> NOTE`;
        } else if (type === 'reminder') {
            icon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> REMINDER`;
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

        div.querySelector('.task-checkbox').addEventListener('change', () => this.toggleTaskComplete(task.id));
        div.querySelector('.task-edit').addEventListener('click', () => this.editTask(task.id));
        div.querySelector('.task-delete').addEventListener('click', () => this.deleteTaskById(task.id));

        return div.firstElementChild; // Return the article element
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceTaskApp();
});
