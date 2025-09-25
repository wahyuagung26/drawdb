const DatabaseService = require('../services/DatabaseService');
const GistsService = require('../services/GistsService');
const { Parser } = require('@dbml/core');
const { nanoid } = require('nanoid');

class DatabaseController {
  /**
   * Test database connection
   */
  static async connect(req, res) {
    try {
      const { type, host, port, username, password, database } = req.body;

      // Validate required fields
      if (!type || !username) {
        return res.status(400).json({
          success: false,
          error: 'Database type and username are required'
        });
      }

      // Validate database type
      const supportedTypes = ['mysql', 'postgres', 'sqlite'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported database type. Supported types: ${supportedTypes.join(', ')}`
        });
      }

      const config = {
        type,
        host: host || 'localhost',
        port: parseInt(port) || (type === 'mysql' ? 3306 : type === 'postgres' ? 5432 : null),
        username,
        password: password || '',
        database: database || null
      };

      // Create connection
      const connectionId = await DatabaseService.createConnection(config);

      // Store connection ID in session
      req.session.connectionId = connectionId;
      req.session.databaseType = type;

      res.json({
        success: true,
        message: 'Connected successfully',
        connectionId,
        databaseType: type
      });

    } catch (error) {
      console.error('Connection error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect to database'
      });
    }
  }

  /**
   * List available databases
   */
  static async listDatabases(req, res) {
    try {
      const connectionId = req.session.connectionId;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: 'No active connection. Please connect to database first.'
        });
      }

      const databases = await DatabaseService.listDatabases(connectionId);

      res.json({
        success: true,
        databases: databases.map(db => ({ name: db, type: 'database' }))
      });

    } catch (error) {
      console.error('List databases error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list databases'
      });
    }
  }

  /**
   * List tables in a specific database
   */
  static async listTables(req, res) {
    try {
      const connectionId = req.session.connectionId;
      const { database } = req.params;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: 'No active connection. Please connect to database first.'
        });
      }

      if (!database) {
        return res.status(400).json({
          success: false,
          error: 'Database name is required'
        });
      }

      const tables = await DatabaseService.listTables(connectionId, database);

      res.json({
        success: true,
        database,
        tables: tables.map(table => ({
          name: table.name,
          type: table.type || 'table',
          rowCount: table.rowCount || null,
          size: table.size || null
        }))
      });

    } catch (error) {
      console.error('List tables error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list tables'
      });
    }
  }

  /**
   * Get schema for selected tables
   */
  static async getSchema(req, res) {
    try {
      const connectionId = req.session.connectionId;
      const { database, tables } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: 'No active connection. Please connect to database first.'
        });
      }

      if (!database || !tables || !Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Database name and tables array are required'
        });
      }

      const schema = await DatabaseService.getTableSchema(connectionId, database, tables);

      // Store schema in session for DBML generation
      req.session.lastSchema = {
        database,
        tables,
        schema,
        timestamp: new Date()
      };

      res.json({
        success: true,
        database,
        selectedTables: tables,
        schema
      });

    } catch (error) {
      console.error('Get schema error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get table schema'
      });
    }
  }

  /**
   * Generate DBML from schema
   */
  static async generateDBML(req, res) {
    try {
      const { database, tables, options = {} } = req.body;
      const connectionId = req.session.connectionId;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: 'No active connection. Please connect to database first.'
        });
      }

      // Get schema if not provided
      let schema;
      if (req.session.lastSchema &&
          req.session.lastSchema.database === database &&
          JSON.stringify(req.session.lastSchema.tables.sort()) === JSON.stringify(tables.sort())) {
        schema = req.session.lastSchema.schema;
      } else {
        schema = await DatabaseService.getTableSchema(connectionId, database, tables);
      }

      // Generate DBML
      const dbml = DatabaseController.convertSchemaToDBML(schema, options);

      // Store DBML for potential future use
      req.session.lastDBML = {
        database,
        tables,
        dbml,
        timestamp: new Date()
      };

      res.json({
        success: true,
        database,
        tables,
        dbml,
        schema
      });

    } catch (error) {
      console.error('Generate DBML error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate DBML'
      });
    }
  }

  /**
   * Import to main app (redirect with diagram JSON data)
   */
  static async importToApp(req, res) {
    try {
      const { database, tables, options = {} } = req.body;
      const connectionId = req.session.connectionId;

      if (!connectionId) {
        return res.redirect('/db-import?error=' + encodeURIComponent('No active connection'));
      }

      // Generate DBML
      const schema = await DatabaseService.getTableSchema(connectionId, database, tables);
      const dbml = DatabaseController.convertSchemaToDBML(schema, options);

      // Convert DBML to diagram JSON format using the existing DBML parser
      const diagramData = DatabaseController.convertDBMLToDiagram(dbml, database);

      // Clean up connection
      if (options.closeConnection !== false) {
        await DatabaseService.closeConnection(connectionId);
        delete req.session.connectionId;
      }

      // Save diagram JSON to gists storage (consistent with POST /api/gists format)
      const shareId = await GistsService.create({
        filename: 'share.json',
        description: `DrawDB diagram - ${database}`,
        content: JSON.stringify(diagramData),
        public: false
      });

      // Create redirect URL with shareId
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const redirectUrl = `${clientUrl}/editor?shareId=${shareId}`;

      res.json({
        success: true,
        redirectUrl,
        shareId,
        message: 'Diagram generated and saved successfully. Redirecting to main app...'
      });

    } catch (error) {
      console.error('Import to app error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import schema'
      });
    }
  }

  /**
   * Disconnect from database
   */
  static async disconnect(req, res) {
    try {
      const connectionId = req.session.connectionId;

      if (connectionId) {
        await DatabaseService.closeConnection(connectionId);
        delete req.session.connectionId;
        delete req.session.databaseType;
        delete req.session.lastSchema;
        delete req.session.lastDBML;
      }

      res.json({
        success: true,
        message: 'Disconnected successfully'
      });

    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to disconnect'
      });
    }
  }

  /**
   * Get connection status
   */
  static async status(req, res) {
    try {
      const connectionId = req.session.connectionId;
      const databaseType = req.session.databaseType;

      if (!connectionId) {
        return res.json({
          connected: false,
          connectionId: null,
          databaseType: null
        });
      }

      const connection = DatabaseService.getConnection(connectionId);

      res.json({
        connected: !!connection,
        connectionId: connection ? connectionId : null,
        databaseType: connection ? databaseType : null,
        connectedAt: connection ? connection.createdAt : null
      });

    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get connection status'
      });
    }
  }

  /**
   * Convert database schema to DBML format
   */
  static convertSchemaToDBML(schema, options = {}) {
    let dbml = '';

    // Add project info
    dbml += `Project DrawDB_Import {\n`;
    dbml += `  database_type: 'Multi-Database'\n`;
    dbml += `  Note: 'Generated from database import at ${new Date().toISOString()}'\n`;
    dbml += `}\n\n`;

    // Add tables
    for (const table of schema.tables) {
      dbml += `Table ${this.escapeTableName(table.name)} {\n`;

      // Add fields
      for (const field of table.fields) {
        dbml += `  ${this.escapeFieldName(field.name)} ${field.type}`;

        // Add field constraints
        const constraints = [];
        if (field.primary) constraints.push('pk');
        if (field.autoIncrement) constraints.push('increment');
        if (!field.nullable) constraints.push('not null');
        if (field.unique) constraints.push('unique');

        if (constraints.length > 0) {
          dbml += ` [${constraints.join(', ')}`;
          if (field.default !== null && field.default !== undefined) {
            dbml += `, default: ${this.formatDefaultValue(field.default)}`;
          }
          if (field.comment) {
            dbml += `, note: '${field.comment.replace(/'/g, "\\'")}'`;
          }
          dbml += `]`;
        }

        dbml += `\n`;
      }

      dbml += `}\n\n`;
    }

    // Add relationships
    if (schema.relationships && schema.relationships.length > 0) {
      for (const rel of schema.relationships) {
        const cardinality = this.determineCardinality(rel);
        dbml += `Ref: ${this.escapeTableName(rel.fromTable)}.${this.escapeFieldName(rel.fromColumn)} ${cardinality} ${this.escapeTableName(rel.toTable)}.${this.escapeFieldName(rel.toColumn)}`;

        if (rel.updateRule || rel.deleteRule) {
          const actions = [];
          if (rel.updateRule && rel.updateRule !== 'RESTRICT') actions.push(`update: ${rel.updateRule.toLowerCase()}`);
          if (rel.deleteRule && rel.deleteRule !== 'RESTRICT') actions.push(`delete: ${rel.deleteRule.toLowerCase()}`);
          if (actions.length > 0) {
            dbml += ` [${actions.join(', ')}]`;
          }
        }

        dbml += `\n`;
      }
    }

    return dbml;
  }

  /**
   * Helper methods for DBML generation
   */
  static escapeTableName(name) {
    // Escape table names that might have spaces or special characters
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : `"${name}"`;
  }

  static escapeFieldName(name) {
    // Escape field names that might have spaces or special characters
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : `"${name}"`;
  }

  static formatDefaultValue(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    if (typeof value === 'boolean') return value.toString();
    return value;
  }

  static determineCardinality(relationship) {
    // Default to many-to-one relationship
    // TODO: Implement more sophisticated cardinality detection
    return '>';
  }

  /**
   * Convert DBML to DrawDB diagram JSON format
   */
  static convertDBMLToDiagram(dbmlString, databaseName) {
    const parser = new Parser();
    const ast = parser.parse(dbmlString, "dbmlv2");

    const tables = [];
    const relationships = [];
    const enums = [];

    // Constants for cardinality (matching frontend constants)
    const Cardinality = {
      ONE_TO_ONE: 0,
      ONE_TO_MANY: 1,
      MANY_TO_ONE: 2
    };

    // Constants for constraints (matching frontend constants)
    const Constraint = {
      NONE: 0,
      CASCADE: 1,
      RESTRICT: 2,
      'SET NULL': 3,
      'SET DEFAULT': 4
    };

    for (const schema of ast.schemas) {
      // Process tables
      for (const table of schema.tables) {
        let parsedTable = {};
        parsedTable.id = nanoid();
        parsedTable.name = table.name;
        parsedTable.comment = table.note ?? "";
        parsedTable.color = table.headerColor ?? "#175e7a";
        parsedTable.fields = [];
        parsedTable.indices = [];

        for (const column of table.fields) {
          const field = {};

          field.id = nanoid();
          field.name = column.name;
          field.type = column.type.type_name.toUpperCase();
          field.default = column.dbdefault?.value ?? "";
          field.check = "";
          field.primary = !!column.pk;
          field.unique = !!column.pk;
          field.notNull = !!column.not_null;
          field.increment = !!column.increment;
          field.comment = column.note ?? "";

          parsedTable.fields.push(field);
        }

        for (const idx of table.indexes) {
          const parsedIndex = {};

          parsedIndex.id = idx.id - 1;
          parsedIndex.fields = idx.columns.map((x) => x.value);
          parsedIndex.name = idx.name ?? `${parsedTable.name}_index_${parsedIndex.id}`;
          parsedIndex.unique = !!idx.unique;

          parsedTable.indices.push(parsedIndex);
        }

        tables.push(parsedTable);
      }

      // Process relationships
      for (const ref of schema.refs) {
        const startTableName = ref.endpoints[0].tableName;
        const endTableName = ref.endpoints[1].tableName;
        const startFieldName = ref.endpoints[0].fieldNames[0];
        const endFieldName = ref.endpoints[1].fieldNames[0];

        const startTable = tables.find((t) => t.name === startTableName);
        if (!startTable) continue;

        const endTable = tables.find((t) => t.name === endTableName);
        if (!endTable) continue;

        const endField = endTable.fields.find((f) => f.name === endFieldName);
        if (!endField) continue;

        const startField = startTable.fields.find((f) => f.name === startFieldName);
        if (!startField) continue;

        const relationship = {};

        relationship.name = "fk_" + startTableName + "_" + startFieldName + "_" + endTableName;
        relationship.startTableId = startTable.id;
        relationship.endTableId = endTable.id;
        relationship.endFieldId = endField.id;
        relationship.startFieldId = startField.id;
        relationship.id = relationships.length;

        relationship.updateConstraint = ref.onDelete
          ? Constraint[ref.onDelete.toUpperCase()] ?? Constraint.NONE
          : Constraint.NONE;
        relationship.deleteConstraint = ref.onUpdate
          ? Constraint[ref.onUpdate.toUpperCase()] ?? Constraint.NONE
          : Constraint.NONE;

        const startRelation = ref.endpoints[0].relation;
        const endRelation = ref.endpoints[1].relation;

        if (startRelation === "*" && endRelation === "1") {
          relationship.cardinality = Cardinality.MANY_TO_ONE;
        } else if (startRelation === "1" && endRelation === "*") {
          relationship.cardinality = Cardinality.ONE_TO_MANY;
        } else if (startRelation === "1" && endRelation === "1") {
          relationship.cardinality = Cardinality.ONE_TO_ONE;
        } else {
          relationship.cardinality = Cardinality.MANY_TO_ONE; // default
        }

        relationships.push(relationship);
      }

      // Process enums
      for (const schemaEnum of schema.enums) {
        const parsedEnum = {};

        parsedEnum.name = schemaEnum.name;
        parsedEnum.values = schemaEnum.values.map((x) => x.name);

        enums.push(parsedEnum);
      }
    }

    // Arrange tables with simple layout (can be enhanced later)
    let x = 20, y = 20;
    const tableWidth = 200;
    const tableHeight = 150;
    const spacing = 50;
    const tablesPerRow = 3;

    tables.forEach((table, index) => {
      table.x = x;
      table.y = y;

      if ((index + 1) % tablesPerRow === 0) {
        x = 20;
        y += tableHeight + spacing;
      } else {
        x += tableWidth + spacing;
      }
    });

    // Return in DrawDB diagram format
    return {
      database: "mysql", // Default to mysql for imported diagrams
      title: `${databaseName} - Imported`,
      tables,
      relationships,
      notes: [],
      subjectAreas: [],
      transform: { zoom: 1, pan: { x: 0, y: 0 } }
    };
  }

  /**
   * STATELESS API METHODS FOR REACT MODAL
   */

  /**
   * Test database connection without storing in session
   * POST /api/database/test-connection
   */
  static async testConnection(req, res) {
    try {
      const { type, host, port, username, password, database } = req.body;

      // Validate required fields
      if (!type || !username) {
        return res.status(400).json({
          success: false,
          error: 'Database type and username are required'
        });
      }

      // Validate database type
      const supportedTypes = ['mysql', 'postgres', 'sqlite'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported database type. Supported types: ${supportedTypes.join(', ')}`
        });
      }

      const config = {
        type,
        host: host || 'localhost',
        port: parseInt(port) || (type === 'mysql' ? 3306 : type === 'postgres' ? 5432 : null),
        username,
        password: password || '',
        database: database || null
      };

      // Test connection (create and immediately close)
      const connectionId = await DatabaseService.createConnection(config);
      await DatabaseService.closeConnection(connectionId);

      res.json({
        success: true,
        message: 'Connection successful',
        config: {
          type: config.type,
          host: config.host,
          port: config.port,
          database: config.database
        }
      });

    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect to database'
      });
    }
  }

  /**
   * List databases with connection parameters
   * POST /api/database/get-databases
   */
  static async getDatabasesWithConnection(req, res) {
    let connectionId = null;
    try {
      const { type, host, port, username, password, database } = req.body;

      if (!type || !username) {
        return res.status(400).json({
          success: false,
          error: 'Database type and username are required'
        });
      }

      const config = {
        type,
        host: host || 'localhost',
        port: parseInt(port) || (type === 'mysql' ? 3306 : type === 'postgres' ? 5432 : null),
        username,
        password: password || '',
        database: database || null
      };

      // Create temporary connection
      connectionId = await DatabaseService.createConnection(config);
      const databases = await DatabaseService.listDatabases(connectionId);

      res.json({
        success: true,
        databases: databases.map(db => ({ name: db, type: 'database' }))
      });

    } catch (error) {
      console.error('List databases error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list databases'
      });
    } finally {
      // Always cleanup connection
      if (connectionId) {
        try {
          await DatabaseService.closeConnection(connectionId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    }
  }

  /**
   * List tables with connection parameters and database
   * POST /api/database/get-tables
   */
  static async getTablesWithConnection(req, res) {
    let connectionId = null;
    try {
      const { type, host, port, username, password, database, selectedDatabase } = req.body;

      if (!type || !username || !selectedDatabase) {
        return res.status(400).json({
          success: false,
          error: 'Database type, username, and selectedDatabase are required'
        });
      }

      const config = {
        type,
        host: host || 'localhost',
        port: parseInt(port) || (type === 'mysql' ? 3306 : type === 'postgres' ? 5432 : null),
        username,
        password: password || '',
        database: database || null
      };

      // Create temporary connection
      connectionId = await DatabaseService.createConnection(config);
      const tables = await DatabaseService.listTables(connectionId, selectedDatabase);

      res.json({
        success: true,
        database: selectedDatabase,
        tables: tables.map(table => ({
          name: table.name,
          type: table.type || 'table',
          rowCount: table.rowCount || null,
          size: table.size || null
        }))
      });

    } catch (error) {
      console.error('List tables error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list tables'
      });
    } finally {
      // Always cleanup connection
      if (connectionId) {
        try {
          await DatabaseService.closeConnection(connectionId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    }
  }

  /**
   * Import schema directly without session storage
   * POST /api/database/import-schema
   */
  static async importSchemaDirectly(req, res) {
    let connectionId = null;
    try {
      const { type, host, port, username, password, database, selectedDatabase, selectedTables } = req.body;

      if (!type || !username || !selectedDatabase || !selectedTables || !Array.isArray(selectedTables) || selectedTables.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Database type, username, selectedDatabase, and selectedTables array are required'
        });
      }

      const config = {
        type,
        host: host || 'localhost',
        port: parseInt(port) || (type === 'mysql' ? 3306 : type === 'postgres' ? 5432 : null),
        username,
        password: password || '',
        database: database || null
      };

      // Create temporary connection
      connectionId = await DatabaseService.createConnection(config);

      // Get table schema
      const schema = await DatabaseService.getTableSchema(connectionId, selectedDatabase, selectedTables);

      // Generate DBML
      const dbml = DatabaseController.convertSchemaToDBML(schema, {});

      // Convert DBML to diagram JSON format
      const diagramData = DatabaseController.convertDBMLToDiagram(dbml, selectedDatabase);

      res.json({
        success: true,
        database: selectedDatabase,
        selectedTables,
        diagramData
      });

    } catch (error) {
      console.error('Import schema error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import schema'
      });
    } finally {
      // Always cleanup connection
      if (connectionId) {
        try {
          await DatabaseService.closeConnection(connectionId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    }
  }
}

module.exports = DatabaseController;