class VoiceTaskApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.isRecording = false;
        this.recognition = null;
        this.playBeep = null;
        this.editingTaskId = null;

        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAudioContext();
        this.renderTasks();
        this.initializePWA();
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

        this.loadSettings();

        this.micButton.addEventListener('click', () => this.toggleRecording());
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
            if (e.target === this.settingsModal) this.toggleSettings(false);
        });
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
            this.stopRecording(true);
            return;
        }

        // Completion logic
        const completeKeywords = ['complete', 'done', 'finish', 'check off'];
        for (const kw of completeKeywords) {
            if (text.startsWith(kw)) {
                const taskText = text.replace(kw, '').trim();
                if (taskText) {
                    this.completeTask(taskText);
                    return;
                }
            }
        }

        // Deletion logic
        const deleteKeywords = ['delete', 'remove', 'trash', 'remove task'];
        for (const kw of deleteKeywords) {
            if (text.startsWith(kw)) {
                const taskText = text.replace(kw, '').trim();
                if (taskText) {
                    this.deleteTask(taskText);
                    return;
                }
            }
        }

        // Add task (Default)
        // Clean up common "add" prefixes if present
        const addPrefixes = ['add task', 'add', 'create', 'new task'];
        let finalTask = text;
        for (const pre of addPrefixes) {
            if (text.startsWith(pre)) {
                finalTask = text.replace(pre, '').trim();
                break;
            }
        }

        if (finalTask.length > 0) {
            this.addTask(finalTask);
        }
    }

    addTask(text) {
        const task = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.saveTasks();
        this.renderTasks();
        this.triggerSuccessAnimation();
        this.stopRecording(true);
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
            task.text = newText;
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
            this.saveTasks();
            this.renderTasks();
            this.showToast(`Task deleted: ${deletedTask.text}`);
        } else {
            this.showToast(`Task not found: ${taskText}`);
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
        this.syncToCloud();
    }

    async syncToCloud() {
        const url = this.syncUrlInput.value.trim();
        const isEnabled = document.getElementById('toggle-sync').classList.contains('active');

        if (!url || !isEnabled || !url.startsWith('https://script.google.com')) return;

        this.syncStatus.textContent = 'Syncing...';
        this.syncStatus.style.color = 'rgba(255,255,255,0.4)';

        try {
            // Using a Blob with text/plain is the "Magic Bullet" for Google Apps Script
            // It prevents the browser from asking for permission (CORS) but sends the full JSON
            const blob = new Blob([JSON.stringify(this.tasks)], { type: 'text/plain' });

            // Add a timestamp to the URL to prevent Google from "caching" old data
            const syncUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();

            fetch(syncUrl, {
                method: 'POST',
                mode: 'no-cors',
                body: blob
            });

            setTimeout(() => {
                this.syncStatus.textContent = 'Cloud Active';
                this.syncStatus.style.color = '#4ade80';
            }, 500);
        } catch (error) {
            this.syncStatus.textContent = 'Connection Error';
            this.syncStatus.style.color = '#f87171';
        }
    }

    saveSettings() {
        localStorage.setItem('doneSettings', JSON.stringify({
            syncUrl: this.syncUrlInput.value,
            syncEnabled: document.getElementById('toggle-sync').classList.contains('active')
        }));
    }

    loadSettings() {
        const saved = localStorage.getItem('doneSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.syncUrlInput.value = settings.syncUrl || '';
            if (settings.syncEnabled) {
                document.getElementById('toggle-sync').classList.add('active');
            }
        }
    }

    loadTasks() {
        const saved = localStorage.getItem('voiceTasks');
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
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderTasks();
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

        div.innerHTML = `
            <article class="task-card ${task.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}" data-id="${task.id}">
                <input
                    id="task-check-${task.id}"
                    class="task-checkbox"
                    type="checkbox"
                    ${task.completed ? 'checked' : ''}
                    aria-label="Mark task as ${task.completed ? 'active' : 'completed'}"
                />
                <div class="task-main">
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
