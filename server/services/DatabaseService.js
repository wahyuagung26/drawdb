const mysql = require('mysql2/promise');
const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

class DatabaseService {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Create a database connection
   * @param {Object} config - Database configuration
   * @param {string} config.type - Database type (mysql, postgres, sqlite)
   * @param {string} config.host - Database host
   * @param {number} config.port - Database port
   * @param {string} config.username - Database username
   * @param {string} config.password - Database password
   * @param {string} config.database - Database name (optional)
   * @returns {Promise<string>} Connection ID
   */
  async createConnection(config) {
    const connectionId = this.generateConnectionId();
    let connection;

    try {
      switch (config.type) {
        case 'mysql':
          connection = await mysql.createConnection({
            host: config.host || 'localhost',
            port: config.port || 3306,
            user: config.username,
            password: config.password,
            database: config.database,
            connectTimeout: 10000
          });
          break;

        case 'postgres':
          connection = new Client({
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.username,
            password: config.password,
            database: config.database,
            connectionTimeoutMillis: 10000,
            query_timeout: 10000
          });
          await connection.connect();
          break;

        case 'sqlite':
          // SQLite file path should be provided in config.database
          connection = new sqlite3.Database(config.database);
          // Promisify sqlite methods
          connection.allAsync = promisify(connection.all).bind(connection);
          connection.getAsync = promisify(connection.get).bind(connection);
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.connections.set(connectionId, {
        connection,
        type: config.type,
        config: { ...config, password: '[HIDDEN]' }, // Don't store password
        createdAt: new Date()
      });

      return connectionId;
    } catch (error) {
      if (connection) {
        try {
          if (config.type === 'postgres') {
            await connection.end();
          } else if (config.type === 'mysql') {
            await connection.end();
          } else if (config.type === 'sqlite') {
            connection.close();
          }
        } catch (closeError) {
          console.error('Error closing failed connection:', closeError);
        }
      }
      throw error;
    }
  }

  /**
   * Get connection by ID
   * @param {string} connectionId
   * @returns {Object|null}
   */
  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  /**
   * List all databases for a connection
   * @param {string} connectionId
   * @returns {Promise<Array>}
   */
  async listDatabases(connectionId) {
    const conn = this.getConnection(connectionId);
    if (!conn) throw new Error('Connection not found');

    const { connection, type } = conn;

    try {
      switch (type) {
        case 'mysql':
          const [databases] = await connection.execute('SHOW DATABASES');
          return databases
            .map(row => row.Database)
            .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db));

        case 'postgres':
          const result = await connection.query(
            `SELECT datname FROM pg_database
             WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1')`
          );
          return result.rows.map(row => row.datname);

        case 'sqlite':
          // SQLite doesn't have multiple databases, return the current one
          return [conn.config.database || 'main'];

        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
    } catch (error) {
      console.error('Error listing databases:', error);
      throw error;
    }
  }

  /**
   * List all tables for a specific database
   * @param {string} connectionId
   * @param {string} database
   * @returns {Promise<Array>}
   */
  async listTables(connectionId, database) {
    const conn = this.getConnection(connectionId);
    if (!conn) throw new Error('Connection not found');

    const { connection, type } = conn;

    try {
      switch (type) {
        case 'mysql':
          const [mysqlTables] = await connection.execute(`SHOW TABLES FROM \`${database}\``);
          return mysqlTables.map(row => ({
            name: Object.values(row)[0],
            type: 'table'
          }));

        case 'postgres':
          // Switch to the target database if needed
          if (database !== conn.config.database) {
            await connection.end();
            // Create new connection to specific database
            const newConn = new Client({
              ...conn.config,
              database: database
            });
            await newConn.connect();
            conn.connection = newConn;
            conn.config.database = database;
          }

          const result = await connection.query(`
            SELECT tablename as name, 'table' as type
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
          `);
          return result.rows;

        case 'sqlite':
          const sqliteTables = await connection.allAsync(
            "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
          );
          return sqliteTables;

        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
    } catch (error) {
      console.error('Error listing tables:', error);
      throw error;
    }
  }

  /**
   * Get table schema information
   * @param {string} connectionId
   * @param {string} database
   * @param {Array} tableNames
   * @returns {Promise<Object>}
   */
  async getTableSchema(connectionId, database, tableNames) {
    const conn = this.getConnection(connectionId);
    if (!conn) throw new Error('Connection not found');

    const { connection, type } = conn;
    const schema = {
      tables: [],
      relationships: []
    };

    try {
      for (const tableName of tableNames) {
        const tableSchema = await this.getTableStructure(connection, type, database, tableName);
        schema.tables.push(tableSchema);
      }

      // Get relationships (foreign keys)
      const relationships = await this.getTableRelationships(connection, type, database, tableNames);
      schema.relationships = relationships;

      return schema;
    } catch (error) {
      console.error('Error getting table schema:', error);
      throw error;
    }
  }

  /**
   * Get structure for a single table
   */
  async getTableStructure(connection, type, database, tableName) {
    switch (type) {
      case 'mysql':
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY, COLUMN_COMMENT
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [database, tableName]
        );

        return {
          name: tableName,
          fields: columns.map(col => ({
            name: col.COLUMN_NAME,
            type: this.mapDataType(col.DATA_TYPE, type),
            nullable: col.IS_NULLABLE === 'YES',
            default: col.COLUMN_DEFAULT,
            primary: col.COLUMN_KEY === 'PRI',
            autoIncrement: col.EXTRA.includes('auto_increment'),
            unique: col.COLUMN_KEY === 'UNI',
            comment: col.COLUMN_COMMENT
          }))
        };

      case 'postgres':
        const result = await connection.query(`
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        // Get primary keys
        const pkResult = await connection.query(`
          SELECT column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        `, [tableName]);

        const primaryKeys = pkResult.rows.map(row => row.column_name);

        return {
          name: tableName,
          fields: result.rows.map(col => ({
            name: col.column_name,
            type: this.mapDataType(col.data_type, type),
            nullable: col.is_nullable === 'YES',
            default: col.column_default,
            primary: primaryKeys.includes(col.column_name),
            autoIncrement: col.column_default && col.column_default.includes('nextval'),
            unique: false, // TODO: Get unique constraints
            comment: null
          }))
        };

      case 'sqlite':
        const tableInfo = await connection.allAsync(`PRAGMA table_info(${tableName})`);

        return {
          name: tableName,
          fields: tableInfo.map(col => ({
            name: col.name,
            type: this.mapDataType(col.type, type),
            nullable: !col.notnull,
            default: col.dflt_value,
            primary: !!col.pk,
            autoIncrement: col.type.toUpperCase() === 'INTEGER' && !!col.pk,
            unique: false,
            comment: null
          }))
        };

      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  /**
   * Get relationships between tables
   */
  async getTableRelationships(connection, type, database, tableNames) {
    const relationships = [];

    switch (type) {
      case 'mysql':
        const [foreignKeys] = await connection.execute(`
          SELECT
            kcu.TABLE_NAME,
            kcu.COLUMN_NAME,
            kcu.CONSTRAINT_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME,
            rc.UPDATE_RULE,
            rc.DELETE_RULE
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
          WHERE kcu.TABLE_SCHEMA = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
            AND kcu.TABLE_NAME IN (${tableNames.map(() => '?').join(',')})
        `, [database, ...tableNames]);

        for (const fk of foreignKeys) {
          relationships.push({
            fromTable: fk.TABLE_NAME,
            fromColumn: fk.COLUMN_NAME,
            toTable: fk.REFERENCED_TABLE_NAME,
            toColumn: fk.REFERENCED_COLUMN_NAME,
            constraintName: fk.CONSTRAINT_NAME,
            updateRule: fk.UPDATE_RULE,
            deleteRule: fk.DELETE_RULE
          });
        }
        break;

      case 'postgres':
        const result = await connection.query(`
          SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = ANY($1)
        `, [tableNames]);

        for (const fk of result.rows) {
          relationships.push({
            fromTable: fk.table_name,
            fromColumn: fk.column_name,
            toTable: fk.foreign_table_name,
            toColumn: fk.foreign_column_name,
            constraintName: fk.constraint_name,
            updateRule: fk.update_rule,
            deleteRule: fk.delete_rule
          });
        }
        break;

      case 'sqlite':
        for (const tableName of tableNames) {
          const foreignKeys = await connection.allAsync(`PRAGMA foreign_key_list(${tableName})`);

          for (const fk of foreignKeys) {
            relationships.push({
              fromTable: tableName,
              fromColumn: fk.from,
              toTable: fk.table,
              toColumn: fk.to,
              constraintName: `fk_${tableName}_${fk.from}`,
              updateRule: fk.on_update,
              deleteRule: fk.on_delete
            });
          }
        }
        break;
    }

    return relationships;
  }

  /**
   * Map database-specific data types to DrawDB types
   */
  mapDataType(dbType, databaseType) {
    const typeMapping = {
      mysql: {
        'int': 'INT',
        'integer': 'INT',
        'bigint': 'BIGINT',
        'smallint': 'SMALLINT',
        'tinyint': 'TINYINT',
        'varchar': 'VARCHAR',
        'char': 'CHAR',
        'text': 'TEXT',
        'longtext': 'LONGTEXT',
        'mediumtext': 'MEDIUMTEXT',
        'datetime': 'DATETIME',
        'timestamp': 'TIMESTAMP',
        'date': 'DATE',
        'time': 'TIME',
        'decimal': 'DECIMAL',
        'float': 'FLOAT',
        'double': 'DOUBLE',
        'boolean': 'BOOLEAN',
        'json': 'JSON',
        'enum': 'ENUM'
      },
      postgres: {
        'integer': 'INT',
        'bigint': 'BIGINT',
        'smallint': 'SMALLINT',
        'character varying': 'VARCHAR',
        'character': 'CHAR',
        'text': 'TEXT',
        'timestamp without time zone': 'TIMESTAMP',
        'timestamp with time zone': 'TIMESTAMPTZ',
        'date': 'DATE',
        'time': 'TIME',
        'numeric': 'DECIMAL',
        'decimal': 'DECIMAL',
        'real': 'FLOAT',
        'double precision': 'DOUBLE',
        'boolean': 'BOOLEAN',
        'json': 'JSON',
        'jsonb': 'JSONB',
        'uuid': 'UUID'
      },
      sqlite: {
        'INTEGER': 'INT',
        'TEXT': 'TEXT',
        'REAL': 'FLOAT',
        'BLOB': 'BLOB',
        'NUMERIC': 'DECIMAL'
      }
    };

    const mapping = typeMapping[databaseType] || {};
    const normalizedType = dbType.toLowerCase();

    return mapping[normalizedType] || dbType.toUpperCase();
  }

  /**
   * Close a database connection
   * @param {string} connectionId
   */
  async closeConnection(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    try {
      const { connection, type } = conn;

      switch (type) {
        case 'mysql':
          await connection.end();
          break;
        case 'postgres':
          await connection.end();
          break;
        case 'sqlite':
          connection.close();
          break;
      }
    } catch (error) {
      console.error('Error closing connection:', error);
    } finally {
      this.connections.delete(connectionId);
    }
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return 'conn_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Clean up old connections (call periodically)
   */
  cleanupConnections() {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = new Date();

    for (const [connectionId, conn] of this.connections) {
      if (now - conn.createdAt > maxAge) {
        this.closeConnection(connectionId);
      }
    }
  }
}

module.exports = new DatabaseService();