class VoiceTaskApp {
    // Settings getters
    get settings() {
        return JSON.parse(localStorage.getItem('doneSettings') || '{}');
    }

    get GROQ_API_KEY() {
        return this.settings.groqApiKey || '';
    }

    get GROQ_MODEL() {
        return 'llama-3.1-8b-instant';
    }

    get aiTtsEnabled() {
        return this.settings.aiTtsEnabled !== false;
    }

    get soundsEnabled() {
        return this.settings.soundsEnabled !== false;
    }

    get animationsEnabled() {
        return this.settings.animationsEnabled !== false;
    }

    // Fast minimal AI classifier - runs instantly
    classifyTask(text) {
        const t = text.toLowerCase();

        // Priority detection
        let priority = 'medium';
        const urgentWords = ['urgent', 'asap', 'emergency', 'immediately', 'now', 'today', 'critical', 'important', 'deadline'];
        const lowPriorityWords = ['sometime', 'whenever', 'later', 'eventually', 'someday', 'optional', 'maybe'];

        if (urgentWords.some(w => t.includes(w))) priority = 'high';
        else if (lowPriorityWords.some(w => t.includes(w))) priority = 'low';

        // Category detection — ordered by specificity (most specific first)
        let category = 'personal';
        const categories = {
            meeting: ['meeting', 'huddle', 'standup', 'stand-up', 'sync', '1-on-1', 'one on one', 'conference call', 'board meeting', 'team meeting', 'scrum', 'retro', 'kickoff', 'all-hands', 'town hall', 'catch up', 'catch-up'],
            finance: ['invoice', 'budget', 'payment', 'pay', 'bill', 'rent', 'tax', 'taxes', 'transfer', 'deposit', 'bank', 'loan', 'insurance', 'invest', 'salary', 'refund', 'expense'],
            health: ['exercise', 'gym', 'run', 'workout', 'doctor', 'medicine', 'pill', 'appointment', 'health', 'yoga', 'walk', 'jog', 'stretch', 'therapy', 'checkup', 'dentist', 'meds', 'sleep', 'rest', 'physical', 'flu', 'vaccine', 'prescription'],
            shopping: ['grocery', 'groceries', 'shop', 'buy', 'store', 'amazon', 'order', 'supermarket', 'target', 'walmart', 'costco', 'online order', 'package', 'delivery', 'pick up groceries'],
            food: ['breakfast', 'lunch', 'dinner', 'snack', 'eat', 'ate', 'meal', 'cook', 'recipe', 'restaurant', 'takeout', 'pizza', 'burger', 'salad', 'coffee', 'tea', 'water', 'juice', 'smoothie'],
            social: ['birthday', 'party', 'hangout', 'hang out', 'dinner with', 'lunch with', 'drinks with', 'date', 'wedding', 'anniversary', 'reunion', 'visit', 'friends', 'family event', 'get together', 'potluck', 'bbq'],
            errand: ['dry clean', 'laundry', 'car wash', 'oil change', 'mechanic', 'post office', 'library', 'return', 'drop off', 'pick up', 'fix', 'repair', 'maintenance', 'clean', 'organize', 'sort', 'recycle'],
            work: ['email', 'project', 'deadline', 'report', 'client', 'presentation', 'zoom', 'teams', 'board', 'boss', 'colleague', 'office', 'job', 'proposal', 'review', 'submit', 'deploy', 'code', 'design', 'sprint', 'release'],
            urgent: ['urgent', 'asap', 'emergency', 'critical', 'immediately', 'now']
        };

        for (const [cat, words] of Object.entries(categories)) {
            if (words.some(w => t.includes(w))) {
                category = cat;
                break;
            }
        }

        return { category, priority };
    }

    // Groq AI - Smart detection (no keyword required)
    async processWithAI(text) {
        const aiQueryPatterns = [
            /^(what('s| is)|summarize|how many|suggest|help me|tell me)/i,
            /what do i have/i,
            /what('s|s| is) on my/i,
            /show me (my )?(tasks|todos|calendar|schedule|list)/i,
            /what('s| is) (urgent|important|pending|next|coming)/i,
            /list.*tasks/i,
            /hey ai/i,
            /ask ai/i,
            /my (tasks|calendar|schedule|plate|agenda|to do|todo)/i,
            /anything (urgent|important|pending|due)/i,
            /do i have/i,
            /prioritize|priorities/i,
            /^(how|can you|could you|please)/i,
            /(open|go to|take me to|view|access|show) (meal|food|calorie) tracker/i,
            /(open|go to|take me to|view|access|show) (me )?(my )?(meals|food|calories|calorie tracker)/i,
            /(open|go to|take me to|view|access|show) (my )?calendar/i
        ];

        // Exclude specific creating commands to avoid false positives
        if (/^(add|create|remind|new|schedule|book)/i.test(text)) return false;

        const isAIQuery = aiQueryPatterns.some(pattern => pattern.test(text));

        if (isAIQuery) {
            // Check for navigation commands first
            if (/(open|go to|take me to|view|access|show).*(meal|food|calorie|tracker|plate|log)/i.test(text)) {
                this.renderMealTracker();
                this.calorieTrackerModal.classList.add('show');
                this.showAIActivity(1500);
                return true;
            }

            if (/(open|go to|take me to|view|access|show).*(calendar|agenda|schedule)/i.test(text)) {
                this.renderCalendar();
                this.calendarModal.classList.add('show');
                this.showAIActivity(1500);
                return true;
            }

            if (/(open|go to|take me to|view|access|show).*(notes|knowledge|research|stashed)/i.test(text)) {
                this.renderNotes();
                this.notesModal.classList.add('show');
                this.showAIActivity(1500);
                return true;
            }

            this.showAIPanel(true);
            const response = await this.callGroqAI(text);
            if (response) {
                this.showAIPanel(false, response);
                this.speakText(response);
            } else {
                this.dismissAIPanel();
                this.showToast('AI could not respond');
            }
            return true;
        }

        // Check for task breakdown
        if (/break down|divide|split/i.test(text)) {
            const taskMatch = text.replace(/break down|divide|split/i, '').trim();
            if (taskMatch.length > 5) {
                await this.breakdownTask(taskMatch);
                return true;
            }
        }

        return false;
    }

    showAIPanel(loading = false, content = '') {
        const overlay = document.getElementById('aiPanelOverlay');
        const body = document.getElementById('aiPanelBody');
        if (!overlay || !body) return;

        if (loading) {
            body.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-loading-line"></div>
                    <div class="ai-loading-line"></div>
                    <div class="ai-loading-line"></div>
                </div>
            `;
        } else {
            body.innerHTML = this.formatAIResponse(content);
        }

        overlay.classList.add('show');
    }

    dismissAIPanel() {
        const overlay = document.getElementById('aiPanelOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    toggleAITaskCompletion(text, checkboxEl) {
        // Find task by fuzzy text match
        const task = this.tasks.find(t => t.text.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().includes(t.text.toLowerCase()));

        if (task) {
            this.toggleTask(task.id);
            const isCompleted = !task.completed; // toggleTask will flip it, so untoggled state matches UI update

            const li = checkboxEl.closest('li');
            if (task.completed) {
                checkboxEl.classList.add('checked');
                li.classList.add('completed');
            } else {
                checkboxEl.classList.remove('checked');
                li.classList.remove('completed');
            }
        }
    }

    formatAIResponse(text) {
        // Pre-process: strip markdown formatting
        let cleaned = text
            .replace(/\*\*\*(.+?)\*\*\*/g, '$1')     // ***bold italic*** → plain
            .replace(/\*\*(.+?)\*\*/g, '$1')          // **bold** → plain
            .replace(/\*(.+?)\*/g, '$1')              // *italic* → plain
            .replace(/^#{1,4}\s+/gm, '')              // ## headers → plain text
            .replace(/^---+$/gm, '')                   // --- horizontal rules
            .replace(/`([^`]+)`/g, '$1')              // `code` → plain
            .trim();

        const lines = cleaned.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
        let html = '';
        let listStarted = false;
        let headerDone = false;

        lines.forEach((line, index) => {
            const isListItem = /^(\d+[.)]|[-•])\s/.test(line);

            if (isListItem) {
                if (!listStarted) {
                    html += '<ul class="ai-panel-list">';
                    listStarted = true;
                }
                // Clean up list markers and potentially [type] markers
                let clean = line.replace(/^(\d+[.)]|[-•])\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim();
                if (!clean) return;

                const matchingTask = this.tasks.find(t => t.text.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(t.text.toLowerCase()));
                const type = matchingTask ? matchingTask.type : 'task';
                const isCompleted = matchingTask ? matchingTask.completed : false;

                const completedClass = isCompleted ? 'completed' : '';

                // Minimal SVG mapping
                const iconMap = {
                    notification: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
                    event: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
                    meeting: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
                    task: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                };

                html += `<li class="${completedClass}">
                    <div class="ai-list-type-icon ${type}">${iconMap[type] || iconMap.task}</div>
                    <span>${this.escapeHtml(clean)}</span>
                </li>`;
            } else {
                if (listStarted) {
                    html += '</ul>';
                    listStarted = false;
                }

                // First non-list line is the header
                if (!headerDone) {
                    html += `<p class="ai-response-header">${this.escapeHtml(line)}</p>`;
                    headerDone = true;
                } else {
                    html += `<p class="ai-panel-text">${this.escapeHtml(line)}</p>`;
                }
            }
        });

        if (listStarted) html += '</ul>';
        return html || text;
    }

    async callGroqAI(userMessage) {
        if (!this.GROQ_API_KEY) {
            this.dismissAIPanel();
            this.showToast('Add Groq API key in settings to enable AI');
            return null;
        }

        try {
            const taskList = this.tasks.filter(t => !t.completed).slice(0, 20).map(t => {
                const cat = t.category || 'personal';
                const pri = t.priority || 'medium';
                const type = t.type || 'task';
                return `- [${type}] ${t.text} (${cat}, ${pri} priority)`;
            }).join('\n');
            const completedCount = this.tasks.filter(t => t.completed).length;
            const totalCount = this.tasks.length;

            const systemPrompt = `You are a concise, ultra-minimal AI assistant for "Done".
Current ACTIVE tasks (${totalCount - completedCount} active):
${taskList || 'NO ACTIVE TASKS.'}

Format Rules:
1. Start with a short, punchy headline (NO markdown, NO hashtags, NO asterisks).
2. Follow with a list of items using "-" bullet points only.
3. DO NOT use any markdown formatting. No **, no *, no ##, no backticks.
4. DO NOT include type markers (like [event]) in the final response.
5. End with a very brief one-line takeaway.
6. If there are NO ACTIVE TASKS, strictly say "You have a clear plate" or similar.
7. CRITICAL: DO NOT hallucinate. ONLY list tasks provided above. If the user asks for "tomorrow" and nothing is scheduled, say "Nothing for tomorrow".
8. Keep it under 100 words. Use PLAIN TEXT only.`;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.GROQ_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (error) {
            console.log('AI Error:', error.message);
            return null;
        }
    }

    async breakdownTask(taskText) {
        if (!this.GROQ_API_KEY) {
            this.showToast('Add Groq API key in settings to enable AI');
            return;
        }

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.GROQ_MODEL,
                    messages: [
                        { role: 'system', content: 'Break down this task into 3-5 smaller actionable subtasks. Return ONLY a JSON array of strings, nothing else. Example: ["Step 1", "Step 2", "Step 3"]' },
                        { role: 'user', content: taskText }
                    ],
                    max_tokens: 200,
                    temperature: 0.5
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            const subtasks = JSON.parse(content.replace(/```json|```/g, ''));

            if (Array.isArray(subtasks)) {
                subtasks.slice(0, 5).forEach(subtask => {
                    if (subtask && subtask.length > 2) {
                        this.addTask(subtask, 'task');
                    }
                });
                this.showToast(`Created ${subtasks.length} subtasks!`);
            }
        } catch (error) {
            console.log('Breakdown Error:', error.message);
        }
    }

    showToast(message, duration = 3000) {
        if (!this.toastMessage || !this.toast) return;

        // Reset state
        this.toast.classList.remove('expanded');
        this.toast.classList.remove('loading');
        const aiIndicator = document.getElementById('aiIndicator');
        if (aiIndicator) {
            aiIndicator.style.opacity = '0';
            aiIndicator.style.width = '0';
            aiIndicator.style.marginRight = '0';
        }

        const isLong = message.length > 40;

        if (isLong) {
            this.toast.classList.add('expanded');
            if (aiIndicator) {
                aiIndicator.style.opacity = '1';
                aiIndicator.style.width = '6px';
                aiIndicator.style.marginRight = '8px';
            }
        }

        this.toastMessage.textContent = message;
        this.toast.classList.add('show');

        // Clear existing timeout
        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.toast.classList.remove('show');
            // Wait for transition to finish before removing expanded class
            setTimeout(() => {
                this.toast.classList.remove('expanded');
            }, 500);
        }, isLong ? Math.max(duration, 6000) : duration);
    }

    speakText(text) {
        if (!this.aiTtsEnabled) return;
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
        }
    }

    constructor() {
        this.tasks = this.loadTasks();
        this.history = this.loadHistory();
        this.isRecording = false;
        this.recognition = null;
        this.playBeep = null;
        this.editingTaskId = null;
        this.intentDebounceTimer = null;

        this.user = this.loadUser();
        this.meals = this.loadMeals();
        this.notes = this.loadNotes();
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAudioContext();
        this.renderTasks();
        this.initializePWA();

        // Global click listener to close dropdowns and reset z-index (Click Outside)
        document.addEventListener('click', () => {
            document.querySelectorAll('.label-dropdown').forEach(d => {
                d.style.display = 'none';
                const card = d.closest('.task-card');
                if (card) card.style.zIndex = '';
            });
        });

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

        // Intent and Activity elements
        this.intentIndicator = document.getElementById('intentIndicator');
        this.intentText = document.getElementById('intentText');
        this.aiActivityRing = document.getElementById('aiActivityRing');
        this.aiActivityTimer = null;

        // Calorie Tracker elements
        this.calorieTrackerModal = document.getElementById('calorieTrackerModal');
        this.closeCalorieTracker = document.getElementById('closeCalorieTracker');
        this.calorieList = document.getElementById('calorieList');
        this.totalCaloriesEl = document.getElementById('totalCalories');

        // Notes elements
        this.notesModal = document.getElementById('notesModal');
        this.closeNotes = document.getElementById('closeNotes');
        this.notesList = document.getElementById('notesList');
        this.openNotesBtn = document.getElementById('openNotes');

        if (this.closeNotes) {
            this.closeNotes.addEventListener('click', () => {
                this.notesModal.classList.remove('show');
            });
        }

        if (this.openNotesBtn) {
            this.openNotesBtn.addEventListener('click', () => {
                this.renderNotes();
                this.notesModal.classList.add('show');
            });
        }

        if (this.closeCalorieTracker) {
            this.closeCalorieTracker.addEventListener('click', () => {
                this.calorieTrackerModal.classList.remove('show');
            });
        }

        // Edit Meal elements
        this.editMealModal = document.getElementById('editMealModal');
        this.closeEditMeal = document.getElementById('closeEditMeal');
        this.saveMealBtn = document.getElementById('saveMealBtn');
        this.editMealFoodInput = document.getElementById('editMealFood');
        this.editMealCaloriesInput = document.getElementById('editMealCalories');
        this.currentlyEditingMealId = null;

        if (this.closeEditMeal) {
            this.closeEditMeal.addEventListener('click', () => {
                this.editMealModal.classList.remove('show');
                this.currentlyEditingMealId = null;
            });
        }

        if (this.saveMealBtn) {
            this.saveMealBtn.addEventListener('click', () => this.saveMealEdit());
        }

        this.loadSettings();

        // Close label dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.label-dropdown').forEach(d => d.style.display = 'none');
        });

        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.forceSyncBtn.addEventListener('click', () => this.syncToCloud(true));
        if (this.openSettingsBtn) {
            this.openSettingsBtn.addEventListener('click', () => this.toggleSettings(true));
        }
        this.closeSettings.addEventListener('click', () => {
            this.saveSettings();
            this.toggleSettings(false);
        });

        // AI Panel dismiss - only overlay tap is needed now as button is hidden
        const aiPanelOverlay = document.getElementById('aiPanelOverlay');
        if (aiPanelOverlay) {
            aiPanelOverlay.addEventListener('click', (e) => {
                if (e.target === aiPanelOverlay) this.dismissAIPanel();
            });
        }

        // Test AI button
        const testAiBtn = document.getElementById('testAiBtn');
        if (testAiBtn) {
            testAiBtn.addEventListener('click', async () => {
                const apiKey = document.getElementById('groqApiKey').value.trim();
                if (!apiKey) {
                    this.showToast('Enter API key first');
                    return;
                }
                testAiBtn.textContent = 'Testing...';
                try {
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama-3.1-8b-instant',
                            messages: [{ role: 'user', content: 'Hi' }],
                            max_tokens: 10
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        this.showAIActivity(1000);
                    } else {
                        this.showToast('Error: ' + response.status);
                    }
                } catch (e) {
                    this.showToast('Error: ' + e.message);
                }
                testAiBtn.textContent = 'Test';
            });
        }



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

        // Groq API Key live saving
        const groqInput = document.getElementById('groqApiKey');
        if (groqInput) {
            groqInput.addEventListener('input', () => {
                this.saveSettings();
            });
        }

        // Settings toggles auto-save
        document.querySelectorAll('.settings-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                this.saveSettings();
                this.playPing && this.playPing();
            });
        });

        // Export tasks
        const exportTasksData = document.getElementById('exportTasksData');
        if (exportTasksData) {
            exportTasksData.addEventListener('click', () => {
                const data = {
                    tasks: this.tasks,
                    history: this.history,
                    exportedAt: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `done-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showToast('Tasks exported!');
            });
        }

        // Import tasks
        const importTasksData = document.getElementById('importTasksData');
        if (importTasksData) {
            importTasksData.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const text = await file.text();
                            const data = JSON.parse(text);
                            if (data.tasks && Array.isArray(data.tasks)) {
                                this.tasks = data.tasks;
                                this.saveTasks();
                                this.renderTasks();
                                this.showToast(`Imported ${data.tasks.length} tasks!`);
                            }
                        } catch (err) {
                            this.showToast('Invalid file format');
                        }
                    }
                };
                input.click();
            });
        }

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

        // Manual mode - start/stop on tap
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

            // Live Intent Detection
            this.detectLiveIntent(transcript);

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

    detectLiveIntent(text) {
        if (!this.intentIndicator || !this.intentText) return;

        if (!text || text.trim().length === 0) {
            this.intentIndicator.classList.remove('show');
            return;
        }

        const t = text.toLowerCase().trim();
        let intent = 'task';
        let label = 'NEW TASK';

        // AI Query detection
        const aiQueryPatterns = [
            /^(what('s| is)|summarize|how many|suggest|help me|tell me)/i,
            /what do i have/i,
            /what('s|s| is) on my/i,
            /show me (my )?(tasks|todos|calendar|schedule|list|agenda|plan)/i,
            /hey ai/i,
            /ask ai/i,
            /my (tasks|calendar|schedule|plate|agenda|to do|todo)/i,
            /prioritize|priorities/i,
            /view (my )?(calendar|schedule|agenda|tasks|tracker)/i,
            /open (up )?(the )?(calendar|tracker|settings)/i
        ];

        if (aiQueryPatterns.some(p => p.test(t))) {
            intent = 'ai';
            label = 'ASKING AI';
        } else if (t.startsWith('remind') || t.startsWith('notif') || t.startsWith('alert') || t.startsWith('remem') || t.includes('remind me')) {
            intent = 'notification';
            label = 'REMINDER';
        } else if (t.startsWith('note') || t.startsWith('stash') || t.startsWith('write down') || t.startsWith('record')) {
            intent = 'note';
            label = 'NOTE';
        } else if (/(?:ate|had|lunch|dinner|breakfast|snack|calories|cals|calorie tracker|meal|food|pizza|burger|salad|sandwich|coffee|tea|water|juice|fruit|yogurt|cereal|bread|cheese|pasta)/i.test(t)) {
            intent = 'meal';
            label = 'MEAL LOG';
        } else if (/^(event|calendar|meet|appoin|sched|agenda)/i.test(t) || t.includes('meeting') || t.includes('appointment')) {
            intent = 'event';
            label = 'EVENT';
        } else {
            const dateKeywords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'pm', 'am', 'next'];
            if (dateKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(t))) {
                intent = 'event';
                label = 'EVENT';
            }
        }

        this.intentIndicator.className = 'intent-indicator show ' + intent;
        this.intentText.textContent = label;

        // Debounced AI refinement
        if (text.length > 5) {
            clearTimeout(this.intentDebounceTimer);
            this.intentDebounceTimer = setTimeout(async () => {
                const refined = await this.callLiveIntentAI(text);
                if (refined && this.isRecording) {
                    this.intentIndicator.className = 'intent-indicator show ' + refined.intent;
                    this.intentText.textContent = refined.label;
                }
            }, 600);
        }
    }

    async callLiveIntentAI(text) {
        if (!this.GROQ_API_KEY) return null;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant', // Fast model for live feedback
                    messages: [
                        {
                            role: 'system', content: `Classify this voice transcript for a smart todo/calendar app.
                        Return JSON: {"intent": "task|notification|event|ai|note|meal", "label": "2-3 word uppercase label"}.
                        
                        Semantic Rules:
                        1. If seeking information/summary/navigation -> intent: "ai". Labels: OPENING CALENDAR, ANALYZING TASKS, ASKING AI.
                        2. If logging food/eating -> intent: "meal". Labels: MEAL LOG, HEALTH ENTRY.
                        3. If setting future alert -> intent: "notification". Labels: REMINDER, ALERT.
                        4. If storing raw info -> intent: "note". Labels: STASHING NOTE, THOUGHT.
                        5. If time-specific activity -> intent: "event". Labels: NEW EVENT, CALENDAR.
                        6. Default to "task". Labels: NEW TASK, ACTION ITEM.` },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 50,
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return JSON.parse(data.choices?.[0]?.message?.content || '{}');
        } catch (error) {
            console.error('Live Intent AI Error:', error);
            return null;
        }
    }

    async confirmIntentWithAI(text) {
        if (!this.GROQ_API_KEY) return null;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama3-70b-8192',
                    messages: [
                        {
                            role: 'system', content: `You classify voice transcripts for a productivity app. Return JSON only.

INTENTS:
- NAVIGATE: User wants to open a page. "open my calendar", "show notes", "go to settings", "open calorie tracker", "show me my meals". Set navigation field.
- MEAL: Logging food/drink. "I had a burger", "ate pizza for lunch"
- NOTE: Saving info, NOT a to-do. "note the gate code is 4521"
- REMINDER: Time-based alert. "remind me to call mom at 3"
- MEETING: Meeting/sync/huddle/standup/1-on-1. "meeting with John at 3pm", "team standup"
- EVENT: Scheduled non-meeting activity. "dentist Friday", "concert Saturday"
- AI: Asking a question or requesting a summary. "what's on my plate", "summarize my tasks"
- TASK: To-do action (DEFAULT). "buy groceries", "finish report"

NAVIGATION VALUES (only for NAVIGATE intent):
- CALENDAR: calendar, schedule, agenda
- TRACKER: calories, calorie tracker, meals, food tracker, meal tracker
- SETTINGS: settings, preferences, config
- NOTES: notes, my notes

LABELS:
meeting, reminder, event, errand, finance, health, shopping, social, work, food, personal

RULES:
1. "open/show/go to/take me to/view/access" + page name = NAVIGATE. Always.
2. "meeting/sync/huddle/standup" = MEETING intent, label "meeting". Never TASK.
3. "remind me" = REMINDER intent, label "reminder". Never TASK.
4. "call mom" = TASK, label "personal". NOT a meeting.
5. "lunch with Sarah" = EVENT, label "social". NOT a meal.

JSON format:
{"intent":"NAVIGATE|MEAL|NOTE|REMINDER|MEETING|EVENT|AI|TASK","label":"...","confidence":0.0-1.0,"food":"only for MEAL","calories":0,"mealType":"breakfast|lunch|dinner|snack","cleanText":"cleaned text","navigation":"CALENDAR|TRACKER|SETTINGS|NOTES|null"}`
                        },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 200,
                    temperature: 0.05,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return JSON.parse(data.choices?.[0]?.message?.content || '{}');
        } catch (error) {
            console.error('Final Intent AI Error:', error);
            return null;
        }
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
        // Visualizer is optional - SpeechRecognition handles mic permission
        // Skip getUserMedia to avoid duplicate permission popup
        return;

        // Original visualizer code (kept for reference)
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
            this.analyser = null;
        }

        // Reset bars to default state
        if (this.bars) {
            const defaults = [8, 12, 18, 12, 8];
            this.bars.forEach((bar, i) => {
                bar.style.height = `${defaults[i]}px`;
                bar.style.background = '';
                bar.style.opacity = '0.85';
            });
        }

        if (this.recognition) {
            this.recognition.stop();
        }

        const delay = immediate ? 0 : 400;
        setTimeout(() => {
            this.transcription.classList.remove('show');
            this.intentIndicator.classList.remove('show');
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
            this.showAIActivity(1000);
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

    async processVoiceCommand(transcript) {
        let text = transcript.toLowerCase().trim();

        // Resume Audio Context (iOS Policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // 1. INSTANT LOCAL NAVIGATION — zero AI dependency, fires immediately
        // Settings
        if (/\b(settings|config|preferences)\b/i.test(text) && /(open|go|take|show|view|access|settings)/i.test(text)) {
            this.toggleSettings(true);
            return;
        }
        // Calendar
        if (/\b(calendar|schedule|agenda)\b/i.test(text) && /(open|go|take|show|view|access|my)/i.test(text)) {
            this.renderCalendar();
            this.calendarModal.classList.add('show');
            this.showAIActivity(1500);
            return;
        }
        // Notes
        if (/\b(notes?|my notes)\b/i.test(text) && /(open|go|take|show|view|access|my)/i.test(text)) {
            this.renderNotes();
            this.notesModal.classList.add('show');
            this.showAIActivity(1500);
            return;
        }
        // Calorie/Meal Tracker
        if (/\b(calorie|calories|tracker|meal tracker|food tracker|meals)\b/i.test(text) && /(open|go|take|show|view|access|my)/i.test(text)) {
            this.renderMealTracker();
            this.calorieTrackerModal.classList.add('show');
            this.showAIActivity(1500);
            return;
        }

        // 2. High-Fidelity Background AI Refinement
        this.showAIActivity(1500);
        const refined = await this.confirmIntentWithAI(transcript);

        // 2.5 LOCAL KEYWORD SAFETY NET — overrides AI if it clearly got it wrong
        const lowerText = text.toLowerCase();
        let finalIntent = refined?.intent || null;
        let finalLabel = refined?.label || null;
        let finalCleanText = refined?.cleanText || transcript;

        // Force REMINDER if text clearly says "remind me" / "reminder" / "don't forget"
        if (/\b(remind me|reminder|don't forget|do not forget|set a reminder)\b/i.test(lowerText)) {
            finalIntent = 'REMINDER';
            finalLabel = 'reminder';
        }
        // Force MEETING if text clearly says "meeting" / "sync" / "huddle" / "standup"
        if (/\b(meeting|sync|huddle|standup|stand-up|1-on-1|one on one|all-hands|town hall)\b/i.test(lowerText) && !/\b(open|show|go to|view)\b/i.test(lowerText)) {
            finalIntent = 'MEETING';
            finalLabel = 'meeting';
        }
        // Force EVENT if text clearly says "appointment" / "scheduled" / "reservation"
        if (/\b(appointment|reservation|booked|scheduled for)\b/i.test(lowerText)) {
            finalIntent = 'EVENT';
            finalLabel = 'event';
        }

        if (refined || finalIntent) {
            const food = refined?.food;
            const calories = refined?.calories;
            const mealType = refined?.mealType;
            const navigation = refined?.navigation;

            // Handle Navigation — fires for ANY intent that has a navigation value
            if (navigation && navigation !== 'null' && navigation !== null) {
                if (navigation === 'CALENDAR') {
                    this.renderCalendar();
                    this.calendarModal.classList.add('show');
                    this.showAIActivity(1500);
                    return;
                }
                if (navigation === 'TRACKER') {
                    this.renderMealTracker();
                    this.calorieTrackerModal.classList.add('show');
                    this.showAIActivity(1500);
                    return;
                }
                if (navigation === 'SETTINGS') {
                    this.toggleSettings(true);
                    return;
                }
                if (navigation === 'NOTES') {
                    this.renderNotes();
                    this.notesModal.classList.add('show');
                    this.showAIActivity(1500);
                    return;
                }
            }

            // Handle Meal Logging
            if (finalIntent === 'MEAL') {
                const finalFood = food || finalCleanText;
                const finalCals = calories || 0;
                const finalType = mealType || 'snack';
                this.addMealLog(finalFood, finalCals, finalType, transcript);
                return;
            }

            // Handle Note
            if (finalIntent === 'NOTE') {
                this.addNote(finalCleanText || transcript);
                return;
            }

            // Handle Meeting
            if (finalIntent === 'MEETING') {
                this.addTask(finalCleanText || transcript, 'meeting', null, finalLabel || 'meeting');
                return;
            }

            // Handle Reminder
            if (finalIntent === 'REMINDER') {
                this.addTask(finalCleanText || transcript, 'notification', null, finalLabel || 'reminder');
                return;
            }

            // Handle Event
            if (finalIntent === 'EVENT') {
                this.addTask(finalCleanText || transcript, 'event', null, finalLabel || 'event');
                return;
            }

            // Fallback for AI queries
            if (finalIntent === 'AI' || finalIntent === 'NAVIGATE') {
                const handledByAI = await this.processWithAI(text);
                if (handledByAI) return;
            }

            // If AI says it's a task, add as task with AI label
            if (finalIntent === 'TASK') {
                this.addTask(finalCleanText || transcript, 'task', null, finalLabel || null);
                return;
            }
        }

        // 3. Fallback to local logic if AI fails entirely
        if (this.detectMealIntent(text)) return;

        // Local keyword-based type detection as last resort
        if (/\b(remind me|reminder|don't forget)\b/i.test(lowerText)) {
            this.addTask(transcript, 'notification', null, 'reminder');
            return;
        }
        if (/\b(meeting|sync|huddle|standup)\b/i.test(lowerText)) {
            this.addTask(transcript, 'meeting', null, 'meeting');
            return;
        }

        const handledByAI = await this.processWithAI(text);
        if (handledByAI) return;

        this.addTask(transcript, 'task');
    }

    parseDateFromText(text) {
        const now = new Date();
        const lower = text.toLowerCase();
        let targetDate = null;

        // 1. Relative days
        if (lower.includes('tomorrow')) {
            targetDate = new Date(now);
            targetDate.setDate(now.getDate() + 1);
        } else if (lower.includes('today')) {
            targetDate = new Date(now);
        }

        // 2. Days of week
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        for (let i = 0; i < days.length; i++) {
            if (lower.includes(days[i])) {
                targetDate = new Date(now);
                const currentDay = now.getDay();
                const distance = (i + 7 - currentDay) % 7;

                let addDays = distance;
                if (distance === 0 && lower.includes('next')) addDays = 7;
                else if (distance === 0) addDays = 0;
                else if (lower.includes('next ' + days[i])) addDays += 7;

                targetDate.setDate(now.getDate() + addDays);
                break;
            }
        }

        // 3. Absolute dates
        const monthMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(st|nd|rd|th)?/);
        if (monthMatch) {
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const monthIndex = months[monthMatch[1].substring(0, 3)];
            const day = parseInt(monthMatch[2]);
            const year = now.getFullYear();

            targetDate = new Date(year, monthIndex, day);
            if (targetDate < new Date(now.getTime() - 86400000)) { // If passed by more than a day
                targetDate.setFullYear(year + 1);
            }
        }

        // 4. Time parsing
        if (targetDate) {
            targetDate.setHours(9, 0, 0, 0); // Default to 9 AM

            // Match "at 10:30 am", "at 10 am", "at 10", "10:30pm", etc.
            const timeMatch = lower.match(/at\s+(\d{1,2})(:(\d{2}))?\s*(am|pm)?/);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                const meridian = timeMatch[4];

                if (meridian === 'pm' && hours < 12) hours += 12;
                if (meridian === 'am' && hours === 12) hours = 0;

                targetDate.setHours(hours, minutes, 0, 0);
            }
        }

        return targetDate ? targetDate.toISOString() : null;
    }

    addTask(text, type = 'task', specificDate = null, aiLabel = null) {
        // AI classification (local fallback)
        const { category, priority } = this.classifyTask(text);

        const task = {
            id: Date.now(),
            text: text,
            type: type,
            category: aiLabel || category,  // AI label overrides local classifier when available
            priority: priority,
            completed: false,
            createdAt: specificDate || new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.logHistory('CREATED', task);
        this.saveTasks();
        this.renderTasks();
        this.triggerSuccessAnimation();
    }

    updateTaskType(taskId, newType) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.type = newType;
        this.saveTasks();
        this.renderTasks();
    }

    updateTaskCategory(taskId, newCategory) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.category = newCategory;
        this.saveTasks();
        this.renderTasks();
    }

    triggerSuccessAnimation() {
        if (!this.animationsEnabled || !this.micButton) return;
        // Quick flash to indicate success, then immediately back to ready state
        this.micButton.classList.add('success');
        setTimeout(() => {
            this.micButton.classList.remove('success');
            // Immediately reset bars to ready state
            if (this.bars) {
                const defaults = [8, 12, 18, 12, 8];
                this.bars.forEach((bar, i) => {
                    bar.style.height = `${defaults[i]}px`;
                    bar.style.opacity = '0.85';
                });
            }
        }, 300);
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

    showAIActivity(duration = 2000) {
        if (!this.aiActivityRing) return;
        this.aiActivityRing.classList.add('show');
        clearTimeout(this.aiActivityTimer);
        this.aiActivityTimer = setTimeout(() => {
            this.aiActivityRing.classList.remove('show');
        }, duration);
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
        const syncEnabled = document.getElementById('toggle-sync').classList.contains('active');
        const groqKey = document.getElementById('groqApiKey')?.value.trim() || '';

        // New toggles
        const aiTtsEnabled = document.getElementById('toggle-ai-tts')?.classList.contains('active') ?? true;
        const soundsEnabled = document.getElementById('toggle-sounds')?.classList.contains('active') ?? true;
        const animationsEnabled = document.getElementById('toggle-animations')?.classList.contains('active') ?? true;

        localStorage.setItem('doneSettings', JSON.stringify({
            syncUrl: url,
            syncEnabled: syncEnabled,
            user: this.user,
            groqApiKey: groqKey,
            aiTtsEnabled: aiTtsEnabled,
            soundsEnabled: soundsEnabled,
            animationsEnabled: animationsEnabled
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

            // Sync toggle
            const toggleSync = document.getElementById('toggle-sync');
            if (settings.syncEnabled) {
                toggleSync.classList.add('active');
            }

            // AI TTS toggle
            const toggleAiTts = document.getElementById('toggle-ai-tts');
            if (settings.aiTtsEnabled !== false) {
                toggleAiTts.classList.add('active');
            }

            // Sounds toggle
            const toggleSounds = document.getElementById('toggle-sounds');
            if (settings.soundsEnabled !== false) {
                toggleSounds.classList.add('active');
            }

            // Animations toggle
            const toggleAnimations = document.getElementById('toggle-animations');
            if (settings.animationsEnabled !== false) {
                toggleAnimations.classList.add('active');
            }

            this.user = settings.user || null;
            if (this.user) this.updateUserUI();

            // Load Groq API key
            const groqInput = document.getElementById('groqApiKey');
            if (groqInput && settings.groqApiKey) {
                groqInput.value = settings.groqApiKey;
            }
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
            // Group active tasks by category or type
            const groups = {};
            activeTasks.forEach(task => {
                let groupName = task.category || 'personal';
                if (task.type === 'meal') groupName = 'health';
                if (task.type === 'note') groupName = 'personal';

                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(task);
            });

            // Priority order for groups — MUST include all possible categories
            const groupOrder = ['urgent', 'meeting', 'work', 'health', 'finance', 'shopping', 'social', 'errand', 'food', 'reminder', 'event', 'personal'];
            const renderedGroups = new Set();
            groupOrder.forEach(gn => {
                if (groups[gn] && groups[gn].length > 0) {
                    renderedGroups.add(gn);
                    const sectionLabel = document.createElement('div');
                    sectionLabel.className = 'section-label';
                    sectionLabel.textContent = gn;
                    this.taskList.appendChild(sectionLabel);
                    groups[gn].forEach(task => {
                        this.taskList.appendChild(this.createTaskHTML(task));
                    });
                }
            });
            // Catch-all: render any groups not in groupOrder so nothing is silently dropped
            Object.keys(groups).forEach(gn => {
                if (!renderedGroups.has(gn) && groups[gn].length > 0) {
                    const sectionLabel = document.createElement('div');
                    sectionLabel.className = 'section-label';
                    sectionLabel.textContent = gn;
                    this.taskList.appendChild(sectionLabel);
                    groups[gn].forEach(task => {
                        this.taskList.appendChild(this.createTaskHTML(task));
                    });
                }
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

        // AI Labels
        const category = task.category || 'personal';
        const priority = task.priority || 'medium';

        const priorityColors = {
            high: '#ef4444',
            medium: '#f59e0b',
            low: '#22c55e'
        };

        const categoryIcons = {
            meeting: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
            work: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
            health: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
            shopping: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
            finance: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
            social: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
            errand: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
            food: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path></svg>',
            urgent: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
            reminder: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
            event: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>',
            personal: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        };

        // Type badge mapping
        const typeLabels = {
            'notification': 'REMINDER',
            'meeting': 'MEETING',
            'event': 'EVENT',
            'note': 'NOTE',
            'meal': 'MEAL',
            'task': 'TASK'
        };

        const typeIcons = {
            notification: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
            meeting: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
            event: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            note: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
            meal: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path></svg>',
            task: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        };

        const icon = `${typeIcons[type] || typeIcons.task} ${typeLabels[type] || 'TASK'}`;

        const showCheckbox = type !== 'note' && type !== 'meal';

        // Available types and categories for editing
        const allTypes = ['task', 'meeting', 'event', 'notification', 'note'];
        const allCategories = ['personal', 'work', 'meeting', 'health', 'shopping', 'finance', 'social', 'errand', 'food', 'urgent', 'reminder', 'event'];

        const typeOptions = allTypes.map(t =>
            `<div class="label-option ${t === type ? 'active' : ''}" data-type="${t}" data-task-id="${task.id}">${(typeLabels[t] || t).charAt(0) + (typeLabels[t] || t).slice(1).toLowerCase()}</div>`
        ).join('');

        const catOptions = allCategories.map(c =>
            `<div class="label-option ${c === category ? 'active' : ''}" data-cat="${c}" data-task-id="${task.id}">${c.charAt(0).toUpperCase() + c.slice(1)}</div>`
        ).join('');

        div.innerHTML = `
            <article class="task-card ${type} ${task.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}" data-id="${task.id}">
                ${showCheckbox ? `
                <input
                    id="task-check-${task.id}"
                    class="task-checkbox"
                    type="checkbox"
                    ${task.completed ? 'checked' : ''}
                    aria-label="Mark task as ${task.completed ? 'active' : 'completed'}"
                />` : ''}
                <div class="task-main">
                    <div class="task-labels" style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px; position: relative;">
                        <span class="ai-label category-editable" data-task-id="${task.id}" title="Tap to change category">${categoryIcons[category] || categoryIcons.personal} <span style="font-size:9px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;opacity:0.5;">${category}</span></span>
                        <span class="priority-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${priorityColors[priority] || priorityColors.medium};"></span>
                        <div class="label-dropdown category-dropdown" data-for="${task.id}" style="display:none;">${catOptions}</div>
                    </div>
                    <div class="type-badge type-editable" data-task-id="${task.id}" title="Tap to change type" style="cursor:pointer;">
                        ${icon}
                        <div class="label-dropdown type-dropdown" data-for="${task.id}" style="display:none;">${typeOptions}</div>
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

        if (showCheckbox) {
            div.querySelector('.task-checkbox').addEventListener('change', () => this.toggleTask(task.id));
        }
        div.querySelector('.task-edit').addEventListener('click', () => this.editTask(task.id));
        div.querySelector('.task-delete').addEventListener('click', () => this.deleteTaskById(task.id));

        // Editable type badge
        const typeBadge = div.querySelector('.type-editable');
        if (typeBadge) {
            typeBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = typeBadge.querySelector('.type-dropdown');
                const card = div.closest('.task-card');

                // Close all other dropdowns & reset z-index
                document.querySelectorAll('.label-dropdown').forEach(d => {
                    if (d !== dropdown) {
                        d.style.display = 'none';
                        const p = d.closest('.task-card');
                        if (p) p.style.zIndex = '';
                    }
                });

                const isOpen = dropdown.style.display === 'flex';
                dropdown.style.display = isOpen ? 'none' : 'flex';
                if (card) card.style.zIndex = isOpen ? '' : '100';
            });
        }

        // Editable category label
        const catLabel = div.querySelector('.category-editable');
        if (catLabel) {
            catLabel.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = div.querySelector('.category-dropdown');
                const card = div.closest('.task-card');

                // Close all other dropdowns & reset z-index
                document.querySelectorAll('.label-dropdown').forEach(d => {
                    if (d !== dropdown) {
                        d.style.display = 'none';
                        const p = d.closest('.task-card');
                        if (p) p.style.zIndex = '';
                    }
                });

                const isOpen = dropdown.style.display === 'flex';
                dropdown.style.display = isOpen ? 'none' : 'flex';
                if (card) card.style.zIndex = isOpen ? '' : '100';
            });
        }

        // Type dropdown options
        div.querySelectorAll('.type-dropdown .label-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const newType = opt.dataset.type;
                const tid = parseInt(opt.dataset.taskId);
                this.updateTaskType(tid, newType);
            });
        });

        // Category dropdown options
        div.querySelectorAll('.category-dropdown .label-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const newCat = opt.dataset.cat;
                const tid = parseInt(opt.dataset.taskId);
                this.updateTaskCategory(tid, newCat);
            });
        });

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
            <div style="display: flex; gap: 6px;">
                <button id="prevMonth" style="background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; padding:8px; border-radius:10px; transition:all 0.2s;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button id="nextMonth" style="background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; padding:8px; border-radius:10px; transition:all 0.2s;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
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

        // Add hover effects to nav buttons
        ['prevMonth', 'nextMonth'].forEach(id => {
            const btn = document.getElementById(id);
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.color = '#ffffff';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'none';
                btn.style.color = 'rgba(255,255,255,0.5)';
            });
        });

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

                        // Extract time
                        const dateObj = new Date(t.createdAt);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                        // Summary: strip date/time words ONLY for display
                        let summary = t.text
                            .replace(/\b(tomorrow|today)\b/gi, '')
                            .replace(/\b(next|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
                            .replace(/\b(at|around|by)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
                            .replace(/\b(in|on)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,2}(st|nd|rd|th)?\b/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim();

                        if (!summary) summary = t.type === 'event' ? 'Meeting' : 'Task';

                        return `
                            <div class="day-task-item" onclick="this.classList.toggle('expanded')">
                                <div style="display:flex; align-items:center; gap:12px; width:100%;">
                                    <div class="day-task-bullet" style="background: ${color}"></div>
                                    <div class="day-task-text">
                                        <span style="font-weight: 600; color: #0a84ff; font-size: 13px;">${timeStr}</span> 
                                        <span style="margin-left: 4px;">${this.escapeHtml(summary)}</span>
                                    </div>
                                </div>
                                <div class="day-task-full">${this.escapeHtml(t.text)}</div>
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
    detectMealIntent(text) {
        const t = text.toLowerCase();

        // 1. Matches with calories: ate [food] 500 calories
        const calorieMatch = t.match(/(?:ate|had|log|new)\s+(.+?)(?:\s+(?:with|is|has))?\s+(\d+)\s*(?:cals|calories|cal)?(?:\s+(?:for|at))?\s*(lunch|dinner|breakfast|snack)?/i) ||
            t.match(/(.+?)\s+(\d+)\s*(?:cals|calories|cal)(?:\s+(lunch|dinner|breakfast|snack))?/i);

        if (calorieMatch) {
            const food = calorieMatch[1].trim();
            const calories = parseInt(calorieMatch[2]);
            const mealType = calorieMatch[3] || 'snack';
            this.addMealLog(food, calories, mealType, text);
            return true;
        }

        // 2. Matches without calories: ate pizza, I had a burger, pizza for lunch
        const foodPhrases = [
            /^(?:i\s+)?(?:ate|had|logging|log)\s+(.+?)(?:\s+(?:for|at)\s+(lunch|dinner|breakfast|snack))?$/i,
            /(.+?)\s+(?:for|at)\s+(lunch|dinner|breakfast|snack)$/i,
            /^(?:add|new)\s+meal\s+(.+)$/i
        ];

        for (const pattern of foodPhrases) {
            const match = t.match(pattern);
            if (match) {
                const food = match[1].trim();
                const mealType = match[2] || 'snack';
                // If it's just a common word like "today" or "tomorrow", skip
                if (['today', 'tomorrow', 'now'].includes(food)) continue;

                this.addMealLog(food, 0, mealType, text);
                return true;
            }
        }

        // 3. Fallback for specific food names at the start
        const commonFoods = ['pizza', 'burger', 'salad', 'sandwich', 'coffee', 'tea', 'water', 'juice', 'fruit', 'yogurt', 'cereal', 'bread', 'cheese', 'pasta'];
        if (commonFoods.some(food => t.startsWith(food))) {
            this.addMealLog(t, 0, 'snack', text);
            return true;
        }

        return false;
    }

    addMealLog(food, calories, mealType, fullText = '') {
        const meal = {
            id: Date.now(),
            food: food,
            calories: calories,
            type: mealType,
            timestamp: new Date().toISOString()
        };
        this.meals.unshift(meal);
        localStorage.setItem('doneMeals', JSON.stringify(this.meals));

        // Also add to main card list with full detail
        const displayText = fullText || `${food} (${calories} cals)`;
        this.addTask(displayText, 'meal');

        this.triggerSuccessAnimation();
        this.showToast(`Logged ${food} (${calories} cals)`);
    }

    loadMeals() {
        const saved = localStorage.getItem('doneMeals');
        return saved ? JSON.parse(saved) : [];
    }

    loadNotes() {
        const saved = localStorage.getItem('doneNotes');
        return saved ? JSON.parse(saved) : [];
    }

    addNote(text) {
        const note = {
            id: Date.now(),
            content: text,
            timestamp: new Date().toISOString()
        };
        this.notes.unshift(note);
        localStorage.setItem('doneNotes', JSON.stringify(this.notes));

        // Also add to main task list for visibility
        this.addTask(text, 'note');

        this.triggerSuccessAnimation();
        this.showToast('Note stashed');
        this.renderNotes();
    }

    deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        localStorage.setItem('doneNotes', JSON.stringify(this.notes));
        this.renderNotes();
    }

    renderNotes() {
        if (!this.notesList) return;

        if (this.notes.length === 0) {
            this.notesList.innerHTML = '<div style="opacity: 0.3; font-style: italic; padding: 20px; text-align: center;">No notes saved yet.</div>';
            return;
        }

        this.notesList.innerHTML = this.notes.map(n => `
            <div class="note-card">
                <div class="note-content">${this.escapeHtml(n.content)}</div>
                <div class="note-footer">
                    <div class="note-date">${new Date(n.timestamp).toLocaleDateString()} ${new Date(n.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                    <button class="delete-note-btn" onclick="app.deleteNote(${n.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderMealTracker() {
        if (!this.calorieList || !this.totalCaloriesEl) return;

        const today = new Date().toISOString().split('T')[0];
        const todaysMeals = this.meals.filter(m => m.timestamp.startsWith(today));

        const totalCals = todaysMeals.reduce((sum, m) => sum + m.calories, 0);
        this.totalCaloriesEl.textContent = totalCals;

        if (todaysMeals.length === 0) {
            this.calorieList.innerHTML = '<div class="meal-tracker-empty">No meals logged today.</div>';
            return;
        }

        this.calorieList.innerHTML = todaysMeals.map(m => `
            <div class="meal-card">
                <div class="meal-info">
                    <div class="meal-name">${this.escapeHtml(m.food)}</div>
                    <div class="meal-meta">${m.type} • ${new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
                <div class="meal-actions" style="display: flex; gap: 8px; align-items: center;">
                    <div class="meal-calories">${m.calories} <span>KCAL</span></div>
                    <button class="edit-meal-btn" data-id="${m.id}" style="background: rgba(255,255,255,0.05); border: none; border-radius: 6px; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.4);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="delete-meal-btn" data-id="${m.id}" style="background: rgba(255,59,48,0.1); border: none; border-radius: 6px; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #ff3b30;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach listeners
        this.calorieList.querySelectorAll('.edit-meal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.editMeal(btn.dataset.id));
        });
        this.calorieList.querySelectorAll('.delete-meal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMeal(btn.dataset.id));
        });
    }

    editMeal(id) {
        const meal = this.meals.find(m => m.id == id);
        if (!meal) return;

        this.currentlyEditingMealId = id;
        this.editMealFoodInput.value = meal.food;
        this.editMealCaloriesInput.value = meal.calories;
        this.editMealModal.classList.add('show');
    }

    saveMealEdit() {
        if (!this.currentlyEditingMealId) return;
        const meal = this.meals.find(m => m.id == this.currentlyEditingMealId);
        if (!meal) return;

        const newFood = this.editMealFoodInput.value.trim();
        const newCalories = parseInt(this.editMealCaloriesInput.value) || 0;

        if (!newFood) {
            this.showToast('Please enter a food name');
            return;
        }

        meal.food = newFood;
        meal.calories = newCalories;
        localStorage.setItem('doneMeals', JSON.stringify(this.meals));
        this.renderMealTracker();
        this.editMealModal.classList.remove('show');
        this.currentlyEditingMealId = null;
        this.showToast('Meal updated');
    }

    deleteMeal(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        this.meals = this.meals.filter(m => m.id != id);
        localStorage.setItem('doneMeals', JSON.stringify(this.meals));
        this.renderMealTracker();
        this.showToast('Meal deleted');
    }
}

// Initialize Application
window.addEventListener('load', () => {
    new VoiceTaskApp();
});
