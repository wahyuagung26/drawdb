# Task: Laravel Migration File Generation System

## Overview
Implement the comprehensive file generation system for Laravel migrations, handling template rendering, file packaging, and download orchestration. This task coordinates all components to produce the final migration files.

## Architecture Integration

### Dependencies
- **Extends**: `task-core-implementation.md` - Uses core Laravel export structure
- **Utilizes**: `task-type-mapping.md` - Column definitions from type mapping
- **Coordinates**: `task-relationship-handling.md` - Foreign key migrations
- **Serves**: `task-ui-integration.md` - Provides files for download

### File Structure
```
src/utils/exportAs/laravel/
├── fileGeneration.js           # Main file generation logic (new)
├── templateEngine.js           # PHP template rendering (new)
├── migrationPackager.js        # File packaging and ZIP creation (new)
└── timestampManager.js         # Migration timestamp coordination (new)
```

## File Generation Architecture

### 1. Main Generation Orchestrator
```javascript
// src/utils/exportAs/laravel/fileGeneration.js
export function generateMigrationPackage(diagram, options = {}) {
  const generator = new MigrationGenerator(diagram, options);
  return generator.generate();
}

class MigrationGenerator {
  constructor(diagram, options) {
    this.diagram = diagram;
    this.options = {
      format: 'multiple_files',
      includeForeignKeys: true,
      includeIndexes: true,
      includeTimestamps: true,
      includeSoftDeletes: false,
      namingConvention: 'laravel_standard',
      customPrefix: '',
      includeComments: true,
      sourceDatabase: 'mysql',
      ...options
    };

    this.timestampManager = new TimestampManager(options.baseTimestamp);
    this.templateEngine = new TemplateEngine();
    this.validationResults = { warnings: [], errors: [], suggestions: [] };
  }

  async generate() {
    // Phase 1: Validate and prepare data
    this.validateDiagram();
    const processedTables = this.processTableDefinitions();

    // Phase 2: Generate table migrations
    const tableMigrations = this.generateTableMigrations(processedTables);

    // Phase 3: Generate relationship migrations
    const relationshipMigrations = this.generateRelationshipMigrations();

    // Phase 4: Generate index migrations (if separate)
    const indexMigrations = this.generateIndexMigrations(processedTables);

    // Phase 5: Package results
    const packagedResult = this.packageMigrations({
      tables: tableMigrations,
      relationships: relationshipMigrations,
      indexes: indexMigrations
    });

    return packagedResult;
  }

  generateTableMigrations(processedTables) {
    return processedTables.map(table => {
      const timestamp = this.timestampManager.getNextTimestamp();
      const className = this.generateClassName(table.name, 'create');
      const filename = this.generateFilename(timestamp, table.name, 'create');

      const migrationContent = this.templateEngine.renderTableMigration({
        className,
        tableName: table.name,
        columns: table.columns,
        indexes: table.indexes,
        options: this.options
      });

      return {
        type: 'table',
        filename,
        content: migrationContent,
        table: table.name,
        timestamp,
        className
      };
    });
  }
}
```

### 2. Template Engine System
```javascript
// src/utils/exportAs/laravel/templateEngine.js
export class TemplateEngine {
  constructor() {
    this.templates = {
      migration: this.getMigrationTemplate(),
      column: this.getColumnTemplate(),
      index: this.getIndexTemplate(),
      foreignKey: this.getForeignKeyTemplate()
    };
  }

  renderTableMigration(data) {
    const { className, tableName, columns, indexes, options } = data;

    // Generate column definitions
    const columnDefinitions = columns.map(col => this.renderColumn(col)).join('\n            ');

    // Generate index definitions
    const indexDefinitions = indexes?.map(idx => this.renderIndex(idx)).join('\n            ') || '';

    // Add Laravel conventions
    const laravelFeatures = this.generateLaravelFeatures(options);

    return this.templates.migration
      .replace(/{{CLASS_NAME}}/g, className)
      .replace(/{{TABLE_NAME}}/g, tableName)
      .replace(/{{COLUMNS}}/g, columnDefinitions)
      .replace(/{{INDEXES}}/g, indexDefinitions)
      .replace(/{{LARAVEL_FEATURES}}/g, laravelFeatures)
      .replace(/{{COMMENTS}}/g, this.generateMigrationComments(data));
  }

  renderColumn(column) {
    const baseMethod = `$table->${column.laravelMethod}('${column.name}'`;

    // Add parameters (length, precision, etc.)
    const parameters = column.parameters?.length
      ? ', ' + column.parameters.join(', ')
      : '';

    // Add modifiers (nullable, default, etc.)
    const modifiers = column.modifiers?.length
      ? '->' + column.modifiers.join('->')
      : '';

    return `${baseMethod}${parameters})${modifiers};`;
  }

  renderIndex(index) {
    const columns = Array.isArray(index.columns)
      ? `['${index.columns.join("', '")}']`
      : `'${index.columns}'`;

    switch (index.type) {
      case 'primary':
        return `$table->primary(${columns});`;
      case 'unique':
        return `$table->unique(${columns}${index.name ? `, '${index.name}'` : ''});`;
      case 'index':
        return `$table->index(${columns}${index.name ? `, '${index.name}'` : ''});`;
      case 'fulltext':
        return `$table->fullText(${columns}${index.name ? `, '${index.name}'` : ''});`;
      default:
        return `$table->index(${columns});`;
    }
  }

  generateLaravelFeatures(options) {
    const features = [];

    if (options.includeTimestamps) {
      features.push('$table->timestamps();');
    }

    if (options.includeSoftDeletes) {
      features.push('$table->softDeletes();');
    }

    return features.length ? '\n            ' + features.join('\n            ') : '';
  }

  getMigrationTemplate() {
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
        Schema::create('{{TABLE_NAME}}', function (Blueprint $table) {
{{COLUMNS}}{{INDEXES}}{{LARAVEL_FEATURES}}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('{{TABLE_NAME}}');
    }
};`;
  }
}
```

### 3. Timestamp Management System
```javascript
// src/utils/exportAs/laravel/timestampManager.js
export class TimestampManager {
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

  getTimestampFromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}_${month}_${day}_${hour}${minute}${second}`;
  }

  // Generate spaced timestamps for migration ordering
  generateSequentialTimestamps(count) {
    const timestamps = [];
    const baseTime = new Date(this.baseTime);

    for (let i = 0; i < count; i++) {
      const migrationTime = new Date(baseTime.getTime() + (i * 60 * 1000)); // 1 minute apart
      timestamps.push(this.getTimestampFromDate(migrationTime));
    }

    return timestamps;
  }
}
```

### 4. Migration Packaging System
```javascript
// src/utils/exportAs/laravel/migrationPackager.js
import JSZip from 'jszip';

export class MigrationPackager {
  constructor(options = {}) {
    this.options = {
      format: 'multiple_files',
      includeReadme: true,
      packageName: 'laravel_migrations',
      ...options
    };
  }

  packageMigrations(migrations) {
    if (this.options.format === 'single_file') {
      return this.packageAsSingleFile(migrations);
    } else {
      return this.packageAsMultipleFiles(migrations);
    }
  }

  packageAsMultipleFiles(migrations) {
    const zip = new JSZip();
    const allMigrations = [
      ...migrations.tables,
      ...(migrations.relationships || []),
      ...(migrations.indexes || [])
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Add migration files
    allMigrations.forEach(migration => {
      zip.file(migration.filename, migration.content);
    });

    // Add documentation
    if (this.options.includeReadme) {
      zip.file('README.md', this.generateReadme(migrations));
      zip.file('MIGRATION_ORDER.md', this.generateMigrationOrder(allMigrations));
    }

    // Add Laravel-specific files
    zip.file('.env.example', this.generateEnvExample());

    return {
      type: 'zip',
      data: zip,
      filename: `${this.options.packageName}.zip`,
      migrations: allMigrations,
      metadata: this.generateMetadata(migrations)
    };
  }

  packageAsSingleFile(migrations) {
    const allMigrations = [
      ...migrations.tables,
      ...(migrations.relationships || []),
      ...(migrations.indexes || [])
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const combinedContent = this.generateCombinedMigrationFile(allMigrations);

    return {
      type: 'file',
      content: combinedContent,
      filename: `${this.options.packageName}_combined.php`,
      migrations: allMigrations,
      metadata: this.generateMetadata(migrations)
    };
  }

  generateReadme(migrations) {
    const totalTables = migrations.tables.length;
    const totalRelationships = migrations.relationships?.length || 0;
    const totalIndexes = migrations.indexes?.length || 0;

    return `# Laravel Migrations Package

Generated from DrawDB on ${new Date().toISOString()}

## Summary
- **Tables**: ${totalTables}
- **Relationships**: ${totalRelationships}
- **Indexes**: ${totalIndexes}
- **Total Migrations**: ${totalTables + totalRelationships + totalIndexes}

## Installation

1. Copy all migration files to \`database/migrations/\` directory
2. Run: \`php artisan migrate\`

## Migration Order

Migrations are timestamped to ensure proper execution order:

### Table Migrations
${migrations.tables.map(m => `- ${m.filename}`).join('\n')}

### Relationship Migrations
${migrations.relationships?.map(m => `- ${m.filename}`).join('\n') || 'None'}

### Index Migrations
${migrations.indexes?.map(m => `- ${m.filename}`).join('\n') || 'None'}

## Laravel Version Compatibility

These migrations are compatible with Laravel 12.x and use the following features:
- Anonymous class syntax (Laravel 9+)
- Blueprint schema builder
- Standard Laravel migration patterns

## Database Configuration

Update your \`.env\` file with the appropriate database connection:

\`\`\`
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_username
DB_PASSWORD=your_password
\`\`\`

## Running Migrations

\`\`\`bash
# Run all migrations
php artisan migrate

# Check migration status
php artisan migrate:status

# Rollback migrations
php artisan migrate:rollback

# Fresh migration (drops all tables and re-runs)
php artisan migrate:fresh
\`\`\`

## Generated with DrawDB
Database schema editor - https://drawdb.vercel.app
`;
  }

  generateMigrationOrder(migrations) {
    return `# Migration Execution Order

This file documents the intended order of migration execution.

## Execution Sequence

${migrations.map((migration, index) =>
  `${index + 1}. **${migration.filename}**
   - Type: ${migration.type}
   - Table: ${migration.table || 'N/A'}
   - Timestamp: ${migration.timestamp}`
).join('\n\n')}

## Important Notes

- Table creation migrations run first
- Foreign key constraint migrations run after all tables are created
- Index migrations can run after tables and relationships
- Always backup your database before running migrations in production

## Troubleshooting

If migrations fail:

1. Check the migration order above
2. Ensure all referenced tables exist before foreign key constraints
3. Verify database connection and permissions
4. Check Laravel logs for detailed error messages
`;
  }

  generateEnvExample() {
    return `# Database Configuration for Laravel Migrations
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_username
DB_PASSWORD=your_password

# Optional: Specify charset and collation
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
`;
  }

  generateCombinedMigrationFile(migrations) {
    const timestamp = migrations[0]?.timestamp || new Date().getTime();
    const className = 'CreateAllTablesFromDrawDB';

    const upMethods = migrations.map(migration => {
      // Extract the Schema::create content from each migration
      const match = migration.content.match(/Schema::create\([^{]+\{([^}]+)\}/s);
      return match ? match[1].trim() : '';
    }).filter(Boolean);

    const downMethods = migrations.map(migration => {
      const match = migration.content.match(/Schema::dropIfExists\('([^']+)'\)/);
      return match ? `        Schema::dropIfExists('${match[1]}');` : '';
    }).filter(Boolean).reverse(); // Reverse order for rollback

    return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Combined migration file generated from DrawDB
     * Original migrations: ${migrations.length} files
     */
    public function up(): void
    {
${migrations.map((migration, index) => `        // Migration ${index + 1}: ${migration.filename}
        ${migration.content.match(/Schema::create[^;]+;/s)?.[0] || ''}`).join('\n\n')}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
${downMethods.join('\n')}
    }
};`;
  }

  generateMetadata(migrations) {
    return {
      generatedAt: new Date().toISOString(),
      drawdbVersion: '1.0.0', // This would come from package.json
      laravelVersion: '12.x',
      totalMigrations: (migrations.tables?.length || 0) + (migrations.relationships?.length || 0) + (migrations.indexes?.length || 0),
      migrationTypes: {
        tables: migrations.tables?.length || 0,
        relationships: migrations.relationships?.length || 0,
        indexes: migrations.indexes?.length || 0
      },
      packageFormat: this.options.format,
      options: this.options
    };
  }
}
```

## Integration with Other Tasks

### 1. Core Implementation Integration
```javascript
// Enhanced toLaravel function in core implementation
export function toLaravel(diagram, options = {}) {
  const generator = new MigrationGenerator(diagram, options);
  const packageResult = generator.generate();

  // Add packaging
  const packager = new MigrationPackager({
    format: options.format || 'multiple_files',
    packageName: options.packageName || 'laravel_migrations'
  });

  return packager.packageMigrations(packageResult);
}
```

### 2. Type Mapping Integration
```javascript
// Use type mapping results in file generation
generateTableMigrations(processedTables) {
  return processedTables.map(table => {
    // Apply type mapping to each column
    const mappedColumns = table.columns.map(column => {
      const typeMapping = mapDrawDBTypeToLaravel(column, this.options.sourceDatabase);
      return {
        ...column,
        laravelMethod: typeMapping.type,
        parameters: typeMapping.parameters,
        modifiers: typeMapping.modifiers
      };
    });

    return this.generateSingleTableMigration(table, mappedColumns);
  });
}
```

### 3. Relationship Handling Integration
```javascript
// Coordinate with relationship migrations
generateRelationshipMigrations() {
  if (!this.options.includeForeignKeys) {
    return [];
  }

  const relationshipHandler = new RelationshipHandler(this.diagram.references);
  const relationshipMigrations = relationshipHandler.generateMigrations();

  return relationshipMigrations.map(rel => {
    const timestamp = this.timestampManager.getNextTimestamp();
    const className = this.generateClassName(rel.tableName, 'add_foreign_keys');

    return {
      type: 'relationship',
      filename: this.generateFilename(timestamp, rel.tableName, 'add_foreign_keys'),
      content: this.templateEngine.renderRelationshipMigration({
        className,
        tableName: rel.tableName,
        foreignKeys: rel.foreignKeys
      }),
      timestamp,
      table: rel.tableName
    };
  });
}
```

## Testing Strategy

### 1. File Generation Tests
- Template rendering accuracy
- Timestamp uniqueness and ordering
- File naming conventions
- Content validation (PHP syntax)

### 2. Packaging Tests
- ZIP file structure and integrity
- Single file combination logic
- README and documentation generation
- Metadata accuracy

### 3. Integration Tests
- Complete workflow from diagram to files
- Different format options (single vs multiple)
- Large schema handling
- Error recovery and validation

## Success Criteria

### Technical Requirements
- [ ] Generates valid PHP migration files
- [ ] Maintains proper migration timestamp ordering
- [ ] Creates proper ZIP packages with documentation
- [ ] Handles both single and multiple file formats

### Quality Requirements
- [ ] Generated files follow Laravel conventions
- [ ] Template system is maintainable and extensible
- [ ] Proper error handling and validation
- [ ] Comprehensive documentation generation

### Integration Requirements
- [ ] Seamlessly integrates with type mapping system
- [ ] Coordinates with relationship handling
- [ ] Provides clean interface for UI integration
- [ ] Maintains DrawDB architectural patterns

This file generation system provides the final step in the Laravel migrations export process, ensuring that all components work together to produce professional, well-documented Laravel migration packages.