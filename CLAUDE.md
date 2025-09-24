# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DrawDB is a browser-based database schema editor and SQL generator built with React and Vite. It allows users to visually create database diagrams and export SQL scripts for multiple database systems (MySQL, PostgreSQL, SQLite, MS SQL, Oracle, MariaDB).

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (usually http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code (run before commits)
npm run lint
```

## Docker Commands

```bash
# Build and run with Docker
docker build -t drawdb .
docker run -p 3000:80 drawdb
```

## Architecture

### Tech Stack
- **React 18.2** with **Vite** build tool
- **JavaScript (ES2020+)** - No TypeScript
- **@douyinfe/semi-ui** - Main UI component library
- **Tailwind CSS 4.0** - Styling framework
- **React Context** - State management pattern

### Directory Structure
- `src/components/` - React components organized by feature
  - `EditorCanvas/` - Canvas rendering (tables, relationships)
  - `EditorHeader/` - Navigation and modals
  - `EditorSidePanel/` - Side panels for tables, types, enums
- `src/context/` - React Context providers for state
- `src/utils/` - Utility functions
  - `exportSQL/` - Database-specific SQL export
  - `importSQL/` - SQL import parsers
  - `exportAs/` - Export to DBML, Mermaid, etc.
- `src/data/` - Constants, schemas, seed data
- `src/i18n/` - Internationalization (50+ languages)

### State Management
Uses React Context pattern with custom hooks:
- `DiagramContext` - Core diagram state
- `SettingsContext` - User preferences
- `SelectContext` - Selection state
- `UndoRedoContext` - History management

## Code Style

### File Naming
- React components: `.jsx` extension, PascalCase names
- Utilities: `.js` extension, camelCase names
- Components exported as default

### Formatting (Prettier)
- Double quotes for strings
- Semicolons required
- Trailing commas in multiline structures
- 2 spaces indentation
- Arrow function parentheses always included

### ESLint Rules
- React prop-types disabled
- ES2020+ syntax supported
- React refresh rules for HMR

## Development Workflow

### When completing tasks:
1. Run `npm run lint` to check code quality
2. Run `npm run build` to verify production build
3. Test changes with `npm run dev`

### Key Patterns:
- Use existing component structure in `src/components/`
- Follow React Context + custom hooks pattern
- Add database-specific logic to respective utils directories
- Add i18n keys to locale files for user-facing text
- Use Tailwind utility classes for styling

## Important Notes
- No automated test suite - manual testing required
- Database-agnostic design with database-specific implementations
- Supports import/export in multiple formats (SQL, DBML, etc.)
- Optional server component for sharing functionality