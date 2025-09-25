# Code Style and Conventions

## File Extensions
- **JavaScript files**: `.jsx` for React components, `.js` for utilities
- **CSS files**: `.css` for styles
- **No TypeScript** - Project uses vanilla JavaScript with modern ES syntax

## Code Style (Prettier Configuration)
- **Double quotes** for strings (`"singleQuote": false`)
- **Semicolons** required (`"semi": true`)
- **Trailing commas** in multiline structures (`"trailingComma": "all"`)
- **2 spaces** for indentation (`"tabWidth": 2`)
- **Arrow function parentheses** always included (`"arrowParens": "always"`)

## ESLint Rules
- Based on `eslint:recommended` and React plugins
- **React prop-types disabled** (`"react/prop-types": 0`)
- **React refresh rules** for HMR support
- **ES2020+ syntax** supported

## Naming Conventions
- **Components**: PascalCase (e.g., `EditorCanvas`, `TableField`)
- **Files**: Match component names for components, camelCase for utilities
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE in data files
- **CSS classes**: Tailwind utility classes preferred

## Import Organization
- Third-party imports first
- Local imports second
- CSS imports last
- Relative imports using explicit file extensions (`.jsx`, `.js`)

## Component Structure
- Functional components with hooks
- Context consumption via custom hooks
- Props destructuring in function parameters
- Export default at bottom of file