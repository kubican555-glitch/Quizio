# Overview

This is a quiz/testing application built with React and Vite. The application presents multiple-choice questions to users, likely for educational or training purposes. Questions are stored in CSV format and converted to JavaScript through a build script. The app appears to be designed for Czech-language technical questions (based on the content in questions.js), possibly for mechanical engineering or technical certification training.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem:** Need a fast, modern development environment for a React-based quiz application.

**Solution:** Vite + React stack with JSX (not TypeScript, despite TypeScript being configured).

**Rationale:**
- Vite provides fast hot module reloading for rapid development
- React enables component-based UI development
- JSX chosen over TypeScript for simplicity (tsconfig.json exists but `.jsx` files are used)

**Key Design Decisions:**
- Single-page application (SPA) architecture
- Component-based UI structure
- Client-side rendering
- Custom CSS with gradient-based dark theme design system

## Data Management

**Problem:** Need to manage and update quiz questions efficiently.

**Solution:** CSV-to-JavaScript conversion pipeline using a Node.js script (`convert.js`).

**Workflow:**
1. Questions stored in `questions.csv` (semicolon-delimited)
2. Build script (`convert.js`) parses CSV and generates `src/questions.js`
3. Questions exported as JavaScript constant for import into React components

**Data Structure:**
- Each question contains: number, question text, 4 options (A-D), and correct answer index
- Questions are Czech language, technical/mechanical engineering focused

**Pros:**
- Easy question management via CSV (non-developers can edit)
- Version control friendly
- Type-safe data structure after conversion

**Cons:**
- Manual build step required when questions change
- No server-side question management

## Development Environment

**Build Configuration:**
- Vite configured for development server on `0.0.0.0:5000`
- ES modules used throughout (`"type": "module"` in package.json)
- Hot Module Reloading enabled for rapid development

**Scripts:**
- `dev`: Run development server
- `build`: Production build
- `preview`: Preview production build
- Custom `convert.js`: Question data conversion

## Styling Approach

**Solution:** Custom CSS with design system based on gradient themes.

**Design Characteristics:**
- Dark theme with blue/purple gradient backgrounds
- Gradient text effects for headings
- Modern glassmorphism/neumorphism-inspired button styles
- Responsive container-based layout (max-width: 800px)

# External Dependencies

## Core Framework Dependencies

- **React 18.2.0** - UI framework for component-based development
- **React DOM 18.2.0** - DOM rendering for React
- **Vite 5.0.0** - Build tool and development server
- **@vitejs/plugin-react 4.2.0** - React integration for Vite

## Development Dependencies

- **TypeScript 5.2.2** - Configured but not actively used (project uses JSX)
- **@types/react** and **@types/react-dom** - Type definitions (available if migrating to TypeScript)

## Data Processing

- **Node.js fs/path modules** - File system operations for CSV conversion script
- No external CSV parsing library (custom implementation in `convert.js`)

## Hosting Platform

- **Replit** - Development and hosting platform
- Server configured for Replit's networking requirements (host: '0.0.0.0')

## No Backend/Database

- No server-side framework
- No database system
- No authentication system
- All data is static and client-side
- No external API integrations