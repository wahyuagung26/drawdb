/**
 * Laravel Migrations Export for DrawDB
 *
 * Converts DrawDB diagram data to Laravel migration files
 * Follows Laravel 12.x migration patterns and conventions
 */

/**
 * Main export function - converts diagram to Laravel migrations
 * @param {Object} diagram - DrawDB diagram object
 * @param {Array} diagram.tables - Table definitions
 * @param {Array} diagram.references - Foreign key relationships
 * @param {Array} diagram.types - Custom types
 * @param {Array} diagram.enums - Enum definitions
 * @param {string} diagram.database - Source database type
 * @param {Object} options - Export configuration options
 * @returns {Object} Laravel migration package
 */
export function toLaravel(diagram, options = {}) {
  const config = {
    format: 'multiple_files', // 'single_file' | 'multiple_files'
    includeForeignKeys: true,
    includeIndexes: true,
    includeTimestamps: true,
    includeSoftDeletes: false,
    namingConvention: 'laravel_standard',
    customPrefix: '',
    includeComments: true,
    sourceDatabase: diagram.database || 'mysql',
    ...options
  };

  try {
    // Initialize timestamp manager
    const timestampManager = new TimestampManager(options.baseTimestamp);

    // Process tables into migrations
    const tableMigrations = generateTableMigrations(diagram.tables, timestampManager, config);

    // Process relationships into foreign key migrations
    const relationshipMigrations = config.includeForeignKeys
      ? generateRelationshipMigrations(diagram.references, diagram.tables, timestampManager, config)
      : [];

    // Combine and sort migrations by timestamp
    const allMigrations = [
      ...tableMigrations,
      ...relationshipMigrations
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return {
      success: true,
      migrations: allMigrations,
      metadata: {
        version: 'Laravel 12.x',
        sourceDatabase: config.sourceDatabase,
        totalMigrations: allMigrations.length,
        generatedAt: new Date().toISOString(),
        format: config.format
      },
      warnings: [], // Will be populated by validation
      suggestions: [] // Laravel-specific suggestions
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      warnings: [],
      suggestions: []
    };
  }
}

/**
 * Timestamp management for sequential migration numbering
 */
class TimestampManager {
  constructor(baseTimestamp = null) {
    this.baseTime = baseTimestamp || new Date();
    this.currentOffset = 0;
    this.usedTimestamps = new Set();
  }

  getNextTimestamp() {
    let timestamp;
    do {
      timestamp = this.generateTimestamp(this.currentOffset);
      this.currentOffset++;
    } while (this.usedTimestamps.has(timestamp));

    this.usedTimestamps.add(timestamp);
    return timestamp;
  }

  generateTimestamp(offset = 0) {
    const date = new Date(this.baseTime.getTime() + (offset * 1000));

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}_${month}_${day}_${hour}${minute}${second}`;
  }
}

/**
 * Generate table creation migrations
 */
function generateTableMigrations(tables, timestampManager, config) {
  if (!tables || !Array.isArray(tables)) {
    return [];
  }

  return tables.map(table => {
    const timestamp = timestampManager.getNextTimestamp();
    const className = generateClassName(table.name, 'create');
    const filename = generateFilename(timestamp, table.name, 'create');

    return {
      type: 'table',
      filename,
      content: generateTableMigrationContent(table, className, config),
      table: table.name,
      timestamp,
      className
    };
  });
}

/**
 * Generate foreign key relationship migrations
 */
function generateRelationshipMigrations(references, tables, timestampManager, config) {
  if (!references || !Array.isArray(references)) {
    return [];
  }

  // Group foreign keys by target table
  const groupedRelationships = groupRelationshipsByTable(references, tables);
  const migrations = [];

  for (const [tableName, relationships] of groupedRelationships) {
    const timestamp = timestampManager.getNextTimestamp();
    const className = generateClassName(tableName, 'add_foreign_keys');
    const filename = generateFilename(timestamp, tableName, 'add_foreign_keys');

    migrations.push({
      type: 'foreign_keys',
      filename,
      content: generateRelationshipMigrationContent(tableName, relationships, className, config),
      table: tableName,
      timestamp,
      className,
      relationships
    });
  }

  return migrations;
}

/**
 * Group relationships by the table that will have foreign keys added
 */
function groupRelationshipsByTable(references, tables) {
  const grouped = new Map();
  const tableMap = new Map(tables.map(t => [t.id, t]));

  references.forEach(reference => {
    const startTable = tableMap.get(reference.startTableId);
    const endTable = tableMap.get(reference.endTableId);

    if (!startTable || !endTable) return;

    const tableName = startTable.name;
    if (!grouped.has(tableName)) {
      grouped.set(tableName, []);
    }

    const startField = startTable.fields?.find(f => f.id === reference.startFieldId);
    const endField = endTable.fields?.find(f => f.id === reference.endFieldId);

    if (startField && endField) {
      grouped.get(tableName).push({
        localColumn: startField.name,
        foreignTable: endTable.name,
        foreignColumn: endField.name,
        constraintName: `${tableName}_${startField.name}_foreign`,
        onUpdate: mapConstraintAction(reference.updateConstraint),
        onDelete: mapConstraintAction(reference.deleteConstraint)
      });
    }
  });

  return grouped;
}

/**
 * Generate table migration PHP content
 */
function generateTableMigrationContent(table, className, config) {
  const columns = generateColumnDefinitions(table.fields, config);
  const indexes = generateIndexDefinitions(table.indices, config);
  const laravelFeatures = generateLaravelFeatures(config);

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${table.name}', function (Blueprint $table) {
${columns}${indexes}${laravelFeatures}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${table.name}');
    }
};`;
}

/**
 * Generate column definitions for table migration
 */
function generateColumnDefinitions(fields, config) {
  if (!fields || !Array.isArray(fields)) {
    return '';
  }

  const columnDefs = fields.map(field => {
    const laravelMethod = mapFieldTypeToLaravel(field, config.sourceDatabase);
    const modifiers = generateFieldModifiers(field);
    return `            ${laravelMethod}${modifiers};`;
  });

  return columnDefs.length ? '\n' + columnDefs.join('\n') : '';
}

/**
 * Map DrawDB field types to Laravel migration methods
 */
function mapFieldTypeToLaravel(field, sourceDatabase) {
  // Basic type mapping - will be expanded in type mapping task
  const typeMap = {
    'INT': () => `$table->integer('${field.name}')`,
    'BIGINT': () => `$table->bigInteger('${field.name}')`,
    'TINYINT': () => `$table->tinyInteger('${field.name}')`,
    'VARCHAR': () => `$table->string('${field.name}'${field.size && field.size !== 255 ? `, ${field.size}` : ''})`,
    'CHAR': () => `$table->char('${field.name}'${field.size ? `, ${field.size}` : ''})`,
    'TEXT': () => `$table->text('${field.name}')`,
    'LONGTEXT': () => `$table->longText('${field.name}')`,
    'DATETIME': () => `$table->dateTime('${field.name}')`,
    'TIMESTAMP': () => `$table->timestamp('${field.name}')`,
    'DATE': () => `$table->date('${field.name}')`,
    'TIME': () => `$table->time('${field.name}')`,
    'BOOLEAN': () => `$table->boolean('${field.name}')`,
    'DECIMAL': () => `$table->decimal('${field.name}', ${field.precision || 8}, ${field.scale || 2})`,
    'FLOAT': () => `$table->float('${field.name}')`,
    'DOUBLE': () => `$table->double('${field.name}')`,
    'JSON': () => `$table->json('${field.name}')`,
    'UUID': () => `$table->uuid('${field.name}')`,
    'ENUM': () => `$table->enum('${field.name}', [${field.values?.map(v => `'${v}'`).join(', ') || ''}])`,
    'BINARY': () => `$table->binary('${field.name}')`
  };

  const mapper = typeMap[field.type] || typeMap['VARCHAR'];
  return mapper();
}

/**
 * Generate field modifiers (nullable, default, unique, etc.)
 */
function generateFieldModifiers(field) {
  const modifiers = [];

  // Handle primary key
  if (field.primary) {
    // Laravel handles auto-increment automatically for primary keys
    if (field.increment) {
      return ''; // $table->id() equivalent will be handled separately
    }
    modifiers.push('primary()');
  }

  // Nullable constraint
  if (!field.notNull && !field.primary) {
    modifiers.push('nullable()');
  }

  // Default values
  if (field.default !== undefined && field.default !== null && field.default !== '') {
    const defaultValue = formatDefaultValue(field.default, field.type);
    modifiers.push(`default(${defaultValue})`);
  }

  // Unique constraints
  if (field.unique) {
    modifiers.push('unique()');
  }

  // Auto increment
  if (field.increment && !field.primary) {
    modifiers.push('autoIncrement()');
  }

  // Comments
  if (field.comment && field.comment.trim() !== '') {
    modifiers.push(`comment('${escapePhpString(field.comment)}')`);
  }

  return modifiers.length ? '->' + modifiers.join('->') : '';
}

/**
 * Format default values for Laravel migrations
 */
function formatDefaultValue(defaultValue, fieldType) {
  if (defaultValue === null) return 'null';

  switch (fieldType) {
    case 'BOOLEAN':
      return defaultValue === true || defaultValue === 'true' || defaultValue === '1' ? 'true' : 'false';
    case 'INT':
    case 'BIGINT':
    case 'TINYINT':
    case 'DECIMAL':
    case 'FLOAT':
    case 'DOUBLE':
      return defaultValue;
    default:
      return `'${escapePhpString(defaultValue)}'`;
  }
}

/**
 * Generate index definitions
 */
function generateIndexDefinitions(indices, config) {
  if (!config.includeIndexes || !indices || !Array.isArray(indices)) {
    return '';
  }

  const indexDefs = indices.map(index => {
    const columns = Array.isArray(index.fields)
      ? `['${index.fields.join("', '")}']`
      : `'${index.fields}'`;

    if (index.unique) {
      return `            $table->unique(${columns}${index.name ? `, '${index.name}'` : ''});`;
    } else {
      return `            $table->index(${columns}${index.name ? `, '${index.name}'` : ''});`;
    }
  });

  return indexDefs.length ? '\n' + indexDefs.join('\n') : '';
}

/**
 * Generate Laravel-specific features
 */
function generateLaravelFeatures(config) {
  const features = [];

  if (config.includeTimestamps) {
    features.push('            $table->timestamps();');
  }

  if (config.includeSoftDeletes) {
    features.push('            $table->softDeletes();');
  }

  return features.length ? '\n' + features.join('\n') : '';
}

/**
 * Generate foreign key migration content
 */
function generateRelationshipMigrationContent(tableName, relationships, className, config) {
  const foreignKeyStatements = relationships.map(rel => {
    const constraintDef = generateForeignKeyDefinition(rel);
    return `            ${constraintDef}`;
  }).join('\n');

  const dropStatements = relationships.map(rel => {
    return `            $table->dropForeign('${rel.constraintName}');`;
  }).join('\n');

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('${tableName}', function (Blueprint $table) {
${foreignKeyStatements}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('${tableName}', function (Blueprint $table) {
${dropStatements}
        });
    }
};`;
}

/**
 * Generate individual foreign key definition
 */
function generateForeignKeyDefinition(relationship) {
  const { localColumn, foreignTable, foreignColumn, onUpdate, onDelete, constraintName } = relationship;

  // Use Laravel's shorthand if referencing 'id' column and following naming convention
  if (foreignColumn === 'id' && localColumn === `${foreignTable.replace(/s$/, '')}_id`) {
    let definition = `$table->foreignId('${localColumn}')->constrained('${foreignTable}')`;

    if (onUpdate && onUpdate !== 'restrict') {
      definition += `->onUpdate('${onUpdate}')`;
    }

    if (onDelete && onDelete !== 'restrict') {
      definition += `->onDelete('${onDelete}')`;
    }

    return definition + ';';
  } else {
    // Use explicit foreign key syntax
    let definition = `$table->foreign('${localColumn}', '${constraintName}')\n                  ->references('${foreignColumn}')\n                  ->on('${foreignTable}')`;

    if (onUpdate && onUpdate !== 'restrict') {
      definition += `\n                  ->onUpdate('${onUpdate}')`;
    }

    if (onDelete && onDelete !== 'restrict') {
      definition += `\n                  ->onDelete('${onDelete}')`;
    }

    return definition + ';';
  }
}

/**
 * Map constraint actions to Laravel format
 */
function mapConstraintAction(action) {
  const actionMap = {
    'CASCADE': 'cascade',
    'SET_NULL': 'set null',
    'RESTRICT': 'restrict',
    'NO_ACTION': 'no action',
    'SET_DEFAULT': 'set default'
  };

  return actionMap[action] || 'restrict';
}

/**
 * Generate Laravel migration class name
 */
function generateClassName(tableName, action) {
  const pascalTableName = toPascalCase(tableName);

  switch (action) {
    case 'create':
      return `Create${pascalTableName}Table`;
    case 'add_foreign_keys':
      return `AddForeignKeysTo${pascalTableName}`;
    default:
      return `Modify${pascalTableName}Table`;
  }
}

/**
 * Generate migration filename
 */
function generateFilename(timestamp, tableName, action) {
  const snakeTableName = toSnakeCase(tableName);

  switch (action) {
    case 'create':
      return `${timestamp}_create_${snakeTableName}_table.php`;
    case 'add_foreign_keys':
      return `${timestamp}_add_foreign_keys_to_${snakeTableName}.php`;
    default:
      return `${timestamp}_modify_${snakeTableName}_table.php`;
  }
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())
    .replace(/\s+/g, '');
}

/**
 * Convert string to snake_case
 */
function toSnakeCase(str) {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_');
}

/**
 * Escape string for PHP
 */
function escapePhpString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}