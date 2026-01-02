# SPS Quiz Application - Complete

## Overview

This is a professional quiz application built with React and Vite for Czech technical certification training (SPS - mechanical engineering and compressor systems). The app provides multiple learning modes with a modern, responsive design optimized for both desktop and mobile devices.

## User Preferences

- Preferred communication style: Simple, everyday language
- Design philosophy: Modern, clean, and intuitive UI with gradient accents
- Color scheme: Blue and purple gradients on dark background

## Application Modes

### 1. **Flashcards Mode** (Random Mode)
- Present questions in random order
- Instant feedback on answers (green for correct, red for incorrect)
- Unlimited questions - users can cycle through repeatedly
- Score tracking: correct answers / total attempts

### 2. **Mock Test** (Timed Mode)
- 40 random questions from the full question bank
- 30-minute time limit with visual timer
- Timer warnings at 5 minutes (yellow) and 1 minute (red)
- All questions must be answered before submission
- Detailed results with percentage score

### 3. **Training Mode** (Progressive Mode)
- All questions presented in sequence
- Unlimited time for each question
- Progressive unlock: can only navigate to questions already seen
- Tracks time spent on training
- Results show only reviewed questions
- Useful for systematic learning

### 4. **Review Mode** (Reference Mode)
- View all questions in a searchable grid layout
- No interaction required
- Displays correct answers for reference
- Hover effects reveal additional details

## System Architecture

### Frontend Stack
- **React 18.2.0** - Component-based UI with hooks
- **Vite 5.0.0** - Fast build tool with HMR
- **Pure CSS** - No CSS framework; custom design system
- **No external dependencies** - Minimal attack surface, maximum control

### Design System

**Color Palette:**
- Background: Dark blue gradient (#0f172a → #1e293b → #334155)
- Primary: Blue (#3b82f6, #60a5fa)
- Secondary: Purple (#8b5cf6, #a78bfa)
- Success: Green (#22c55e)
- Error: Red (#ef4444)
- Warning: Amber (#fbbf24)
- Neutral: Slate grays (#cbd5e1, #94a3b8)

**Typography:**
- Font: Inter, Segoe UI, Roboto sans-serif
- Titles: 2.8rem, weight 800, gradient text
- Body: 1rem-1.1rem, weight 400-600

**Components:**
- Gradient buttons with hover animations
- Glassmorphism cards with backdrop blur
- Smooth fade/slide animations
- Responsive grid layouts (mobile-first)
- Custom scrollbars matching theme

### State Management

All state is managed locally with React hooks:
```javascript
- mode: Current quiz mode
- questionSet: Shuffled/ordered questions for session
- currentIndex: User's position in question set
- selectedAnswer: Currently selected answer index
- score: Correct answers / total questions
- timeLeft: Remaining time in mock test
- trainingTime: Elapsed time in training mode
- finished: Session completion state
- maxSeenIndex: Furthest question seen (training mode)
```

### Data Flow

1. **Question Loading**: QUESTIONS constant imported from src/questions.js
2. **Mode Start**: Questions shuffled or ordered based on selected mode
3. **Answer Handling**: User selections stored in question objects
4. **Scoring**: Calculated at session end or in real-time
5. **Results**: Filtered/displayed based on mode

### Keyboard Support

Full keyboard navigation for accessibility and power users:
- **W/S or ↑↓**: Cycle through answers
- **A/D or ←→**: Navigate questions
- **Space**: Next question / submit test
- **Backspace**: Clear answer / return to menu
- **Enter**: Confirm actions
- **Escape**: Cancel dialogs / clear results

## Recent Improvements (Session 3)

### Answer Shuffling System
- Answer options shuffle dynamically when questions display
- Fisher-Yates algorithm ensures fair randomization
- Mock/real tests: answers shuffle once at test start, remain fixed throughout
- Smart learning mode: re-shuffles answers when same question reappears
- Answers remain stable during single question interaction

### Keyboard Navigation Improvements
- Visual selection tracking (`visualSelection` state) syncs with shuffled answers
- `shuffledMapping` array communicates between QuestionCard and App
- W/S and arrow keys navigate through visual positions correctly
- State properly resets when returning to menu

### Bug Fixes
- Fixed duplicate "border" key warning in ScheduledTestsList.jsx
- Added `visualSelection` prop to QuestionCard component
- Fixed state cleanup when exiting modes (visualSelection, shuffledMapping reset)

## Previous Improvements (Session 2)

### Design Enhancements
- Complete visual redesign with modern gradient theme
- Blue/purple color scheme replacing basic grays
- Smooth animations and transitions throughout
- Glassmorphism effects on cards and modals
- Responsive typography using CSS clamp()
- Mobile-optimized responsive design

### Bug Fixes
- Fixed timer in mock mode (separated timer logic from submission)
- Added proper auto-submit when time reaches 0
- Fixed answered question button color (blue instead of confusing green)
- Added mobile viewport height fix (--vh CSS variable)
- Smooth navigator auto-scrolling to current question

### Feature Completeness
- Added keyboard shortcut help text in menu
- Fullscreen image viewing with zoom
- Confirmation dialogs for test submission
- Progress indicators showing answered vs unanswered questions
- Time display for training mode (informational)
- Results review showing which questions were missed
- Responsive grid layout for review mode

### Code Quality
- Removed unused App.css file
- Organized CSS into logical sections with comments
- Added media queries for responsive design
- Implemented smooth animations with @keyframes
- Added accessibility labels (aria-label)
- Proper component composition (small helper components)

## File Structure

```
/
├── src/
│   ├── App.jsx              (Main app component - modes, state, logic)
│   ├── questions.js         (Question data - generated from CSV)
│   ├── index.jsx            (React entry point)
│   ├── images/              (Question images - 1.png to 504.png)
│   └── styles/
│       └── globals.css      (Complete design system - 444 lines)
├── convert.js               (CSV → JavaScript converter)
├── questions.csv            (Source question data)
├── vite.config.js           (Vite build configuration)
├── package.json             (Dependencies: React, Vite)
├── index.html               (HTML entry point)
└── replit.md               (This file)
```

## Performance Optimizations

- Images loaded with Vite glob for static analysis
- Efficient state updates with functional setters
- Refs for keyboard focus management
- Smooth scrolling with native browser API
- CSS animations instead of JS animations
- Minimal re-renders with proper dependencies

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Fallback for images using transparent PNG
- Touch-friendly button sizing (min 48px × 48px)
- Responsive design from 320px to 2560px

## Deployment

- Configured for Replit platform
- Vite dev server on 0.0.0.0:5000
- Hot module reloading enabled
- Ready for static hosting (npm run build)

## Future Enhancements (Optional)

- Backend API for question storage
- User authentication and progress tracking
- Analytics and performance metrics
- Question filtering by category/difficulty
- Leaderboard system
- Multi-language support
- Dark/light theme toggle
- Export results to PDF
