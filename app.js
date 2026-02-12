class VoiceTaskApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.isRecording = false;
        this.recognition = null;
        this.installPrompt = null;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializePWA();
        this.renderTasks();
    }
    
    initializeElements() {
        this.voiceBtn = document.getElementById('voiceBtn');
        this.micIcon = document.getElementById('micIcon');
        this.soundBars = document.getElementById('soundBars');
        this.statusText = document.getElementById('statusText');
        this.transcription = document.getElementById('transcription');
        this.transcriptText = document.getElementById('transcriptText');
        this.taskList = document.getElementById('taskList');
        this.taskCount = document.getElementById('taskCount');
        this.installBtn = document.getElementById('installBtn');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        
        this.voiceBtn.addEventListener('click', () => this.toggleRecording());
        this.initializeAudioContext();
    }
    
    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create oscillator for beep sound
            this.createBeepSound();
        } catch (error) {
            console.log('Audio context not available');
        }
    }
    
    createBeepSound() {
        if (!this.audioContext) return;
        
        this.playBeep = (frequency = 800, duration = 100) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
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
            this.statusText.textContent = 'Listening...';
            this.playBeep && this.playBeep(600, 80); // Start beep
        };
        
        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            
            this.transcriptText.textContent = transcript;
            this.transcription.classList.remove('hidden');
            
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
    
    initializePWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('SW registered'))
                .catch(error => console.log('SW registration failed'));
        }
        
        // Install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.installBtn.classList.remove('hidden');
        });
        
        this.installBtn.addEventListener('click', () => {
            if (this.installPrompt) {
                this.installPrompt.prompt();
                this.installPrompt.userChoice.then((result) => {
                    this.installPrompt = null;
                    this.installBtn.classList.add('hidden');
                });
            }
        });
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
    
    stopRecording() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.statusText.textContent = 'Tap to speak';
        this.playBeep && this.playBeep(400, 80); // End beep
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        setTimeout(() => {
            this.transcription.classList.add('hidden');
            this.transcriptText.textContent = '';
        }, 3000);
    }
    
    updateRecordingUI(recording) {
        if (recording) {
            this.voiceBtn.classList.add('recording');
            this.soundBars.classList.remove('hidden');
        } else {
            this.voiceBtn.classList.remove('recording');
            this.soundBars.classList.add('hidden');
        }
    }
    
    processVoiceCommand(transcript) {
        const command = transcript.toLowerCase().trim();
        
        // Add task commands
        if (command.startsWith('add task') || command.startsWith('add') || command.startsWith('create')) {
            const taskText = command.replace(/^(add task|add|create)\s+/i, '').trim();
            if (taskText) {
                this.addTask(taskText);
                return;
            }
        }
        
        // Complete task commands
        if (command.startsWith('complete') || command.startsWith('done') || command.startsWith('finish')) {
            const taskText = command.replace(/^(complete|done|finish)\s+/i, '').trim();
            if (taskText) {
                this.completeTask(taskText);
                return;
            }
        }
        
        // Delete task commands
        if (command.startsWith('delete') || command.startsWith('remove')) {
            const taskText = command.replace(/^(delete|remove)\s+/i, '').trim();
            if (taskText) {
                this.deleteTask(taskText);
                return;
            }
        }
        
        // Clear completed tasks
        if (command.includes('clear completed') || command.includes('clear done')) {
            this.clearCompletedTasks();
            return;
        }
        
        // If no specific command, treat as add task
        if (command.length > 0) {
            this.addTask(transcript);
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
        this.showToast(`Task added: ${text}`);
    }
    
    completeTask(taskText) {
        const task = this.tasks.find(t => 
            t.text.toLowerCase().includes(taskText.toLowerCase()) && !t.completed
        );
        
        if (task) {
            task.completed = true;
            this.saveTasks();
            this.renderTasks();
            this.showToast(`Task completed: ${task.text}`);
        } else {
            this.showToast(`Task not found: ${taskText}`);
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
    
    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }
    
    deleteTaskById(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderTasks();
    }
    
    renderTasks() {
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = `
                <div class="text-center py-16 text-gray-500 floating-hint">
                    <svg class="w-20 h-20 mx-auto mb-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                    <p class="text-lg font-medium mb-2">Ready when you are</p>
                    <p class="text-sm">Tap the microphone and speak your first task</p>
                </div>
            `;
            this.taskCount.textContent = '0';
            return;
        }
        
        const activeTasks = this.tasks.filter(t => !t.completed);
        const completedTasks = this.tasks.filter(t => t.completed);
        
        let html = '';
        
        // Active tasks
        if (activeTasks.length > 0) {
            html += '<div class="mb-6"><h4 class="text-sm font-medium text-gray-400 mb-3">ACTIVE</h4>';
            activeTasks.forEach(task => {
                html += this.createTaskHTML(task);
            });
            html += '</div>';
        }
        
        // Completed tasks
        if (completedTasks.length > 0) {
            html += '<div><h4 class="text-sm font-medium text-gray-400 mb-3">COMPLETED</h4>';
            completedTasks.forEach(task => {
                html += this.createTaskHTML(task);
            });
            html += '</div>';
        }
        
        this.taskList.innerHTML = html;
        this.taskCount.textContent = activeTasks.length;
        
        // Add event listeners
        this.tasks.forEach(task => {
            const checkbox = document.getElementById(`checkbox-${task.id}`);
            const deleteBtn = document.getElementById(`delete-${task.id}`);
            
            if (checkbox) {
                checkbox.addEventListener('change', () => this.toggleTaskComplete(task.id));
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteTaskById(task.id));
            }
        });
    }
    
    createTaskHTML(task) {
        return `
            <div class="task-item glass-morphism rounded-xl p-4 fade-in ${task.completed ? 'opacity-50' : ''}">
                <div class="flex items-start space-x-3">
                    <input 
                        type="checkbox" 
                        id="checkbox-${task.id}"
                        class="checkbox-custom mt-1"
                        ${task.completed ? 'checked' : ''}
                    >
                    <div class="flex-1 min-w-0">
                        <p class="${task.completed ? 'line-through text-gray-500' : 'text-white'} break-words">${task.text}</p>
                        <p class="text-xs text-gray-500 mt-2">${this.formatDate(task.createdAt)}</p>
                    </div>
                    <button 
                        id="delete-${task.id}"
                        class="text-gray-400 hover:text-red-400 transition-colors p-2 flex-shrink-0"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }
    
    showToast(message) {
        this.toastMessage.textContent = message;
        this.toast.classList.remove('translate-x-full');
        this.toast.classList.add('translate-x-0');
        
        setTimeout(() => {
            this.toast.classList.remove('translate-x-0');
            this.toast.classList.add('translate-x-full');
        }, 3000);
    }
    
    saveTasks() {
        localStorage.setItem('voiceTasks', JSON.stringify(this.tasks));
    }
    
    loadTasks() {
        const saved = localStorage.getItem('voiceTasks');
        return saved ? JSON.parse(saved) : [];
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceTaskApp();
});
