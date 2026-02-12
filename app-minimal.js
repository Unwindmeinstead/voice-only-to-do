class VoiceTaskApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.isRecording = false;
        this.recognition = null;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAudioContext();
    }
    
    initializeElements() {
        this.micButton = document.getElementById('micButton');
        this.transcription = document.getElementById('transcription');
        this.transcriptText = document.getElementById('transcriptText');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        this.voiceWaves = document.getElementById('voiceWaves');
        this.particles = document.getElementById('particles');
        
        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.createParticles();
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
            this.playBeep && this.playBeep(600, 80);
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
    
    stopRecording() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.playBeep && this.playBeep(400, 80);
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        setTimeout(() => {
            this.transcription.classList.remove('show');
            this.transcriptText.textContent = '';
        }, 3000);
    }
    
    updateRecordingUI(recording) {
        if (recording) {
            this.micButton.classList.add('recording');
            this.voiceWaves.classList.add('active');
        } else {
            this.micButton.classList.remove('recording');
            this.voiceWaves.classList.remove('active');
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
        this.showToast(`Task added: ${text}`);
    }
    
    completeTask(taskText) {
        const task = this.tasks.find(t => 
            t.text.toLowerCase().includes(taskText.toLowerCase()) && !t.completed
        );
        
        if (task) {
            task.completed = true;
            this.saveTasks();
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
