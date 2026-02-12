# Voice Task - Voice Only Todo App

A beautiful, minimal Progressive Web App (PWA) focused entirely on voice input for task management.

## Features

- 🎤 **Voice-Only Input**: Add, complete, and delete tasks using natural voice commands
- 📱 **PWA Ready**: Install as a native app on your device
- 🎨 **Beautiful UI**: Minimal, modern design with smooth animations
- 💾 **Local Storage**: Tasks persist between sessions
- 🔄 **Offline Support**: Works without internet connection
- 📝 **Smart Commands**: Natural language processing for task operations

## Voice Commands

- **Add tasks**: "Add task buy groceries" or just "buy groceries"
- **Complete tasks**: "Complete buy groceries" or "Done buy groceries"
- **Delete tasks**: "Delete buy groceries" or "Remove buy groceries"
- **Clear completed**: "Clear completed" or "Clear done"

## Getting Started

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
2. Allow microphone permissions when prompted
3. Click the microphone button and start speaking your tasks
4. Install the app using the "Install App" button for a native experience

## Browser Support

This app uses the Web Speech API, which is supported in:
- Chrome/Edge (full support)
- Firefox (limited support)
- Safari (limited support)

For the best experience, use Chrome or Edge on desktop or mobile.

## Technical Stack

- **HTML5**: Semantic markup
- **TailwindCSS**: Utility-first styling
- **Vanilla JavaScript**: No frameworks, pure JS
- **Web Speech API**: Voice recognition
- **Service Worker**: Offline functionality
- **LocalStorage**: Data persistence

## PWA Features

- Installable on desktop and mobile
- Works offline
- Fast loading
- Native app-like experience
- Responsive design

## Development

To run locally:

```bash
# Serve the files (any static server will work)
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` in your browser.

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- Voice processing happens entirely in your browser
- No tracking or analytics

## License

MIT License - feel free to use and modify for your own projects.
