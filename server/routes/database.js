const express = require('express');
const DatabaseController = require('../controllers/DatabaseController');

const router = express.Router();

/**
 * @route POST /api/database/connect
 * @desc Test database connection and create session
 * @body {type, host, port, username, password, database}
 */
router.post('/connect', DatabaseController.connect);

/**
 * @route GET /api/database/databases
 * @desc List all available databases for current connection
 */
router.get('/databases', DatabaseController.listDatabases);

/**
 * @route GET /api/database/tables/:database
 * @desc List all tables in specified database
 * @param {string} database - Database name
 */
router.get('/tables/:database', DatabaseController.listTables);

/**
 * @route POST /api/database/schema
 * @desc Get schema information for selected tables
 * @body {database, tables}
 */
router.post('/schema', DatabaseController.getSchema);

/**
 * @route POST /api/database/generate-dbml
 * @desc Generate DBML from database schema
 * @body {database, tables, options}
 */
router.post('/generate-dbml', DatabaseController.generateDBML);

/**
 * @route POST /api/database/import
 * @desc Import schema to main DrawDB app
 * @body {database, tables, options}
 */
router.post('/import', DatabaseController.importToApp);

/**
 * @route POST /api/database/disconnect
 * @desc Disconnect from current database
 */
router.post('/disconnect', DatabaseController.disconnect);

/**
 * @route GET /api/database/status
 * @desc Get current connection status
 */
router.get('/status', DatabaseController.status);

// Error handling middleware for database routes
router.use((error, req, res, next) => {
  console.error('Database route error:', error);
  res.status(500).json({
    success: false,
    error: 'Database operation failed',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;