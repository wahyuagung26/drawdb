import axios from "axios";

const baseUrl = import.meta.env.VITE_BACKEND_URL;

/**
 * Test database connection
 */
export async function testConnection(connectionConfig) {
  const res = await axios.post(`${baseUrl}/api/database/test-connection`, {
    type: connectionConfig.type,
    host: connectionConfig.host,
    port: connectionConfig.port,
    username: connectionConfig.username,
    password: connectionConfig.password,
    database: connectionConfig.database,
  });

  return res.data;
}

/**
 * Get list of databases with connection parameters
 */
export async function getDatabases(connectionConfig) {
  const res = await axios.post(`${baseUrl}/api/database/get-databases`, {
    type: connectionConfig.type,
    host: connectionConfig.host,
    port: connectionConfig.port,
    username: connectionConfig.username,
    password: connectionConfig.password,
    database: connectionConfig.database,
  });

  return res.data;
}

/**
 * Get list of tables with connection parameters and selected database
 */
export async function getTables(connectionConfig, selectedDatabase) {
  const res = await axios.post(`${baseUrl}/api/database/get-tables`, {
    type: connectionConfig.type,
    host: connectionConfig.host,
    port: connectionConfig.port,
    username: connectionConfig.username,
    password: connectionConfig.password,
    database: connectionConfig.database,
    selectedDatabase: selectedDatabase,
  });

  return res.data;
}

/**
 * Import database schema directly to diagram data
 */
export async function importSchema(connectionConfig, selectedDatabase, selectedTables) {
  const res = await axios.post(`${baseUrl}/api/database/import-schema`, {
    type: connectionConfig.type,
    host: connectionConfig.host,
    port: connectionConfig.port,
    username: connectionConfig.username,
    password: connectionConfig.password,
    database: connectionConfig.database,
    selectedDatabase: selectedDatabase,
    selectedTables: selectedTables,
  });

  return res.data;
}

/**
 * Database types supported
 */
export const DATABASE_TYPES = [
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "postgres", label: "PostgreSQL", defaultPort: 5432 },
  { value: "sqlite", label: "SQLite", defaultPort: null },
];