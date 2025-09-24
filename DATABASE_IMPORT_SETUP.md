# Database Import Feature - Setup Guide

This guide explains how to set up and use the new hybrid architecture that adds direct database connection capabilities to DrawDB.

## Architecture Overview

The implementation uses a **Hybrid Architecture** approach:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐
│   React App     │    │   Node.js Server │    │   Database   │
│  (Frontend)     │◄──►│    (Backend)     │◄──►│   (MySQL/    │
│  Port: 5173     │    │   Port: 3001     │    │ PostgreSQL/  │
│                 │    │                  │    │   SQLite)    │
└─────────────────┘    └──────────────────┘    └──────────────┘
```

- **React App**: Existing DrawDB interface (unchanged)
- **Node.js Server**: New backend for database connections
- **Database**: Direct connection to user's database

## Installation

### 1. Install Dependencies

```bash
# Install main project dependencies (if not already done)
npm install

# Install server dependencies
npm run install:server
```

### 2. Server Configuration

```bash
# Copy environment template
cp server/.env.example server/.env

# Edit server/.env file with your preferences
# Default values work for development
```

### 3. Development Setup

**Option A: Run Both Servers (Recommended)**
```bash
npm run dev:full
```

This runs:
- React app on http://localhost:5173
- Node.js server on http://localhost:3001
- Database import page at http://localhost:3001/db-import

**Option B: Run Separately**
```bash
# Terminal 1: React app
npm run dev

# Terminal 2: Node.js server
npm run dev:server
```

## Usage

### 1. Access Database Import

From DrawDB editor:
1. Click **"Import"** dropdown
2. Select **"Live Database"** (marked as "New")
3. This opens the database import wizard

### 2. Database Connection

**Supported Databases:**
- MySQL
- PostgreSQL
- SQLite (file path)

**Connection Steps:**
1. Select database type
2. Enter connection details:
   - Host (default: localhost)
   - Port (3306 for MySQL, 5432 for PostgreSQL)
   - Username
   - Password
   - Database name (optional)

### 3. Import Process

1. **Connect**: Test database connection
2. **Select Database**: Choose from available databases
3. **Select Tables**: Pick tables to import
4. **Import**: Generate DBML schema
5. **Edit**: Redirected to DrawDB editor with imported schema

### 4. Example Connection Settings

**Local MySQL (XAMPP/WAMP):**
```
Type: MySQL
Host: localhost
Port: 3306
Username: root
Password: (empty)
```

**Local PostgreSQL:**
```
Type: PostgreSQL
Host: localhost
Port: 5432
Username: postgres
Password: your_password
```

**SQLite File:**
```
Type: SQLite
Host: /path/to/your/database.sqlite
```

## Security Notes

- Database credentials are handled server-side only
- No credentials stored in browser
- Connections are temporary and closed after import
- Uses secure session management

## Troubleshooting

### Common Issues

**1. "Connection failed"**
- Verify database is running
- Check host/port settings
- Ensure user has proper permissions

**2. "No tables found"**
- Check database name is correct
- Verify user has SELECT permissions
- Database might be empty

**3. "Cannot connect to server"**
- Ensure Node.js server is running (`npm run dev:server`)
- Check server port (default: 3001)
- Verify no firewall blocking connections

### Development Issues

**1. "Module not found" errors**
- Run `npm run install:server`
- Check all dependencies are installed

**2. "Port already in use"**
- Change PORT in server/.env
- Kill existing processes using the port

**3. React app can't reach server**
- Verify CLIENT_URL in server/.env matches React app URL
- Check CORS configuration

## Production Deployment

### Option 1: Same Server
```bash
# Build both applications
npm run build:full

# Start production server
npm start
```

### Option 2: Separate Deployment
- Deploy React app to Vercel/Netlify
- Deploy Node.js server to Railway/Heroku
- Update CLIENT_URL in server environment

## API Endpoints

The server exposes these endpoints:

```
POST /api/database/connect          # Test connection
GET  /api/database/databases        # List databases
GET  /api/database/tables/:db       # List tables
POST /api/database/schema          # Get table schema
POST /api/database/import          # Import to DrawDB
GET  /db-import                    # Import wizard page
```

## Architecture Files

**New Files Added:**
```
server/
├── app.js                     # Express server
├── package.json              # Server dependencies
├── .env.example              # Environment template
├── controllers/
│   └── DatabaseController.js # Request handlers
├── services/
│   └── DatabaseService.js    # Database operations
├── routes/
│   └── database.js           # API routes
└── views/
    └── db-import.ejs         # Import wizard UI
```

**Modified Files:**
```
package.json                   # Added server scripts
src/pages/LandingPage.jsx     # Import URL handling
src/components/Workspace.jsx   # DBML import processing
src/components/EditorHeader/ControlPanel.jsx # Menu option
```

## Development Scripts

```bash
npm run dev              # React app only
npm run dev:server       # Node.js server only
npm run dev:full         # Both servers
npm run install:server   # Install server deps
npm run build           # Build React app
npm run build:server    # Install server prod deps
npm run build:full      # Build everything
npm start              # Production server
```

## Next Steps

1. Test with your local database
2. Try importing different table structures
3. Verify DBML generation accuracy
4. Report any issues or suggestions

This hybrid approach maintains the existing DrawDB experience while adding powerful database connectivity features!