# Development Commands

## Essential Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Installation
```bash
# Install dependencies
npm install
```

## Docker Commands
```bash
# Build Docker image
docker build -t drawdb .

# Run Docker container
docker run -p 3000:80 drawdb
```

## Code Quality
- **Linting**: `npm run lint` - Uses ESLint with React plugins
- **Formatting**: Prettier is configured but no npm script (IDE integration expected)
- **No test suite** - Project doesn't include automated tests

## Development Workflow
1. `npm install` - Install dependencies
2. `npm run dev` - Start development server (usually http://localhost:5173)
3. `npm run lint` - Check code quality before commits
4. `npm run build` - Build for production deployment

## Additional Notes
- Uses Vite dev server with HMR (Hot Module Replacement)
- No separate test command - no testing framework configured
- No separate format command - relies on IDE integration with Prettier