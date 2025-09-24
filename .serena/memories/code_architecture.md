# Code Architecture

## Directory Structure
```
src/
├── components/          # React components organized by feature
│   ├── EditorCanvas/   # Canvas rendering (tables, relationships, etc.)
│   ├── EditorHeader/   # Top navigation and modals
│   ├── EditorSidePanel/ # Side panels for tables, types, etc.
│   ├── LexicalEditor/  # Rich text editor components
│   └── CodeEditor/     # Code editor with syntax highlighting
├── context/            # React Context providers for state management
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
│   ├── exportSQL/     # SQL export for different databases
│   ├── importSQL/     # SQL import parsers
│   ├── exportAs/      # Export to various formats (DBML, etc.)
│   └── importFrom/    # Import from various formats
├── data/              # Constants, schemas, seed data
├── i18n/              # Internationalization files
├── pages/             # Top-level page components
├── api/               # External API integrations
└── assets/            # Static assets (images, icons)
```

## State Management
- **React Context** - Primary state management pattern
- Multiple contexts for different concerns:
  - DiagramContext: Core diagram state
  - SettingsContext: User preferences
  - SelectContext: Selection state
  - UndoRedoContext: History management
  - And others for specific features

## Key Architectural Patterns
- **Component-based architecture** with feature-organized folders
- **Context + Custom hooks** for state management
- **Utility-first approach** with dedicated utils directory
- **Database-agnostic** design with database-specific implementations
- **Modular export/import** system supporting multiple formats