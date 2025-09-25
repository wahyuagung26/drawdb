# Development Workflow and Task Completion

## What to do when a task is completed
1. **Lint the code**: Run `npm run lint` to check for code quality issues
2. **Build verification**: Run `npm run build` to ensure production build works
3. **Manual testing**: Test changes in development server (`npm run dev`)

## Development Best Practices
- Follow the existing component structure in `src/components/`
- Use React Context pattern for state management
- Implement database-specific logic in respective `utils/exportSQL/` or `utils/importSQL/` directories
- Add internationalization keys to locale files when adding user-facing text
- Maintain consistent styling with Tailwind classes
- Use existing custom hooks pattern for logic reuse

## Git Workflow
- Project uses main branch
- Recent commits show focus on bug fixes and feature improvements
- Docker and build configuration updates are common

## Key Files to Check When Making Changes
- `src/data/constants.js` - Application constants
- `src/context/` - For state-related changes
- `src/utils/` - For utility functions
- `src/i18n/locales/en.js` - For new text strings
- `package.json` - For dependency changes

## No automated testing
- Project doesn't include test suites
- Manual testing in browser is primary verification method
- Use development server for rapid iteration