# Task: Laravel Data Type Mapping System

## Overview
Implement comprehensive data type translation from DrawDB's universal type system to Laravel 12 migration methods. This task builds upon the core implementation to provide accurate type mapping across all supported database systems.

## Architecture Integration

### Dependencies
- **Extends**: `task-core-implementation.md` - Uses core Laravel export structure
- **Integrates**: `src/data/datatypes.js` - Source of truth for type definitions
- **Utilizes**: `src/utils/exportSQL/shared.js` - Existing type utilities

### File Structure
```
src/utils/exportAs/laravel.js
├── typeMapping.js           # Type mapping logic (new section)
├── modifierMapping.js       # Column modifiers (new section)
└── validationUtils.js       # Type validation (new section)
```

## Type Mapping Architecture

### 1. Core Type Mapper
```javascript
function mapDrawDBTypeToLaravel(field, sourceDatabase) {
  const typeRegistry = {
    // Numeric types
    'INT': (field) => buildColumnMethod('integer', field),
    'BIGINT': (field) => buildColumnMethod('bigInteger', field),
    'TINYINT': (field) => buildColumnMethod('tinyInteger', field),
    'SMALLINT': (field) => buildColumnMethod('smallInteger', field),
    'MEDIUMINT': (field) => buildColumnMethod('mediumInteger', field),

    // Decimal types
    'DECIMAL': (field) => buildColumnMethod('decimal', field, {
      precision: field.precision || 8,
      scale: field.scale || 2
    }),
    'FLOAT': (field) => buildColumnMethod('float', field),
    'DOUBLE': (field) => buildColumnMethod('double', field),

    // String types
    'VARCHAR': (field) => buildColumnMethod('string', field, {
      length: field.size || 255
    }),
    'CHAR': (field) => buildColumnMethod('char', field, {
      length: field.size || 1
    }),
    'TEXT': (field) => buildColumnMethod('text', field),
    'MEDIUMTEXT': (field) => buildColumnMethod('mediumText', field),
    'LONGTEXT': (field) => buildColumnMethod('longText', field),

    // Date/Time types
    'DATE': (field) => buildColumnMethod('date', field),
    'DATETIME': (field) => buildColumnMethod('dateTime', field),
    'TIMESTAMP': (field) => buildColumnMethod('timestamp', field),
    'TIME': (field) => buildColumnMethod('time', field),
    'YEAR': (field) => buildColumnMethod('year', field),

    // Special types
    'JSON': (field) => buildColumnMethod('json', field),
    'ENUM': (field) => buildColumnMethod('enum', field, {
      values: field.values || []
    }),
    'SET': (field) => buildColumnMethod('set', field, {
      values: field.values || []
    }),
    'BOOLEAN': (field) => buildColumnMethod('boolean', field),
    'UUID': (field) => buildColumnMethod('uuid', field),
    'BINARY': (field) => buildColumnMethod('binary', field),

    // Fallback
    'DEFAULT': (field) => buildColumnMethod('string', field)
  };

  const mapper = typeRegistry[field.type] || typeRegistry.DEFAULT;
  return mapper(field, sourceDatabase);
}
```

### 2. Column Method Builder
```javascript
function buildColumnMethod(laravelType, field, options = {}) {
  const method = {
    type: laravelType,
    name: field.name,
    parameters: [],
    modifiers: []
  };

  // Add parameters based on type
  switch (laravelType) {
    case 'string':
    case 'char':
      if (options.length && options.length !== 255) {
        method.parameters.push(options.length);
      }
      break;

    case 'decimal':
      method.parameters.push(options.precision, options.scale);
      break;

    case 'enum':
    case 'set':
      method.parameters.push(options.values.map(v => `'${v}'`).join(', '));
      break;
  }

  // Add field modifiers
  method.modifiers = buildFieldModifiers(field);

  return method;
}
```

### 3. Field Modifiers System
```javascript
function buildFieldModifiers(field) {
  const modifiers = [];

  // Nullable constraint
  if (!field.notNull) {
    modifiers.push('nullable()');
  }

  // Default values
  if (field.default !== undefined && field.default !== null) {
    const defaultValue = formatDefaultValue(field.default, field.type);
    modifiers.push(`default(${defaultValue})`);
  }

  // Primary key (handled separately in table generation)
  // Unique constraints
  if (field.unique) {
    modifiers.push('unique()');
  }

  // Auto increment (for integer types)
  if (field.increment && isIncrementableType(field.type)) {
    modifiers.push('autoIncrement()');
  }

  // Unsigned (for numeric types)
  if (field.unsigned && isNumericType(field.type)) {
    modifiers.push('unsigned()');
  }

  // Comments
  if (field.comment) {
    modifiers.push(`comment('${escapeComment(field.comment)}')`);
  }

  return modifiers;
}
```

## Database-Specific Type Handling

### 1. Source Database Adaptation
```javascript
function adaptTypeForSourceDatabase(field, sourceDatabase) {
  const adaptations = {
    'mysql': adaptMySQLType,
    'postgres': adaptPostgreSQLType,
    'sqlite': adaptSQLiteType,
    'mssql': adaptMSSQLType,
    'oracle': adaptOracleType,
    'mariadb': adaptMariaDBType
  };

  const adapter = adaptations[sourceDatabase] || ((field) => field);
  return adapter(field);
}

function adaptMySQLType(field) {
  // MySQL-specific type adaptations
  switch (field.type) {
    case 'TINYINT':
      // MySQL TINYINT(1) often represents boolean
      if (field.size === 1) {
        return { ...field, type: 'BOOLEAN' };
      }
      break;
    case 'MEDIUMINT':
      // Laravel has specific mediumInteger support
      return field;
    case 'GEOMETRY':
      // Convert to JSON for Laravel compatibility
      return { ...field, type: 'JSON' };
  }
  return field;
}

function adaptPostgreSQLType(field) {
  // PostgreSQL-specific adaptations
  switch (field.type) {
    case 'SERIAL':
      return { ...field, type: 'INT', increment: true };
    case 'BIGSERIAL':
      return { ...field, type: 'BIGINT', increment: true };
    case 'JSONB':
      return { ...field, type: 'JSON' }; // Laravel handles JSONB automatically
    case 'UUID':
      return field; // Laravel supports UUID natively
  }
  return field;
}
```

### 2. Type Validation System
```javascript
function validateTypeMapping(field, sourceDatabase) {
  const validations = [
    validateNumericPrecision,
    validateStringLength,
    validateEnumValues,
    validateDateTimeFormat,
    validateBinarySize
  ];

  const warnings = [];
  const errors = [];

  validations.forEach(validation => {
    const result = validation(field, sourceDatabase);
    if (result.warning) warnings.push(result.warning);
    if (result.error) errors.push(result.error);
  });

  return { warnings, errors };
}

function validateNumericPrecision(field) {
  if (field.type === 'DECIMAL') {
    if (field.precision > 65) {
      return {
        warning: `DECIMAL precision ${field.precision} exceeds Laravel maximum (65), using 65`
      };
    }
    if (field.scale > 30) {
      return {
        warning: `DECIMAL scale ${field.scale} exceeds Laravel maximum (30), using 30`
      };
    }
  }
  return {};
}
```

## Output Generation

### 1. Column Definition Format
```php
// Basic column
$table->integer('id');

// Column with length
$table->string('name', 100);

// Column with precision/scale
$table->decimal('price', 10, 2);

// Column with modifiers
$table->string('email')->unique()->nullable();

// Column with default
$table->boolean('is_active')->default(true);

// Column with comment
$table->text('description')->comment('User description');
```

### 2. Special Laravel Features
```javascript
function addLaravelSpecificColumns(table, method) {
  const specialColumns = {
    // Auto-timestamps
    timestamps: () => '$table->timestamps();',

    // Soft deletes
    softDeletes: () => '$table->softDeletes();',

    // Remember token (for authentication)
    rememberToken: () => '$table->rememberToken();',

    // Primary UUID
    uuidPrimary: (name = 'id') => `$table->uuid('${name}')->primary();`,

    // Foreign ID shorthand
    foreignId: (name, references) =>
      `$table->foreignId('${name}')->constrained('${references}');`
  };

  // Detect and suggest Laravel conventions
  if (hasTimestampFields(table)) {
    method.suggestions.push({
      type: 'laravel_timestamps',
      message: 'Consider using $table->timestamps() for created_at/updated_at',
      replacement: specialColumns.timestamps()
    });
  }
}
```

## Integration with Core Implementation

### 1. Core Function Integration
```javascript
// In src/utils/exportAs/laravel.js
function generateTableMigration(table, timestamp, options) {
  const className = `Create${toPascalCase(table.name)}Table`;
  const columns = table.fields.map(field => {
    const adaptedField = adaptTypeForSourceDatabase(field, options.sourceDatabase);
    const laravelMethod = mapDrawDBTypeToLaravel(adaptedField, options.sourceDatabase);
    return formatColumnDefinition(laravelMethod);
  });

  return {
    filename: `${timestamp}_create_${table.name}_table.php`,
    content: generateMigrationFile(className, table.name, columns, table.indices),
    type: 'table'
  };
}
```

### 2. Error Handling and Warnings
```javascript
function generateWithValidation(table, options) {
  const validationResults = table.fields.map(field =>
    validateTypeMapping(field, options.sourceDatabase)
  );

  const allWarnings = validationResults.flatMap(r => r.warnings);
  const allErrors = validationResults.flatMap(r => r.errors);

  if (allErrors.length > 0) {
    throw new Error(`Type mapping errors: ${allErrors.join(', ')}`);
  }

  const migration = generateTableMigration(table, options.timestamp, options);

  if (allWarnings.length > 0) {
    migration.warnings = allWarnings;
  }

  return migration;
}
```

## Testing Strategy

### 1. Type Mapping Tests
- Test all DrawDB types → Laravel method conversion
- Verify parameter handling (length, precision, scale)
- Test modifier application (nullable, default, unique)
- Validate database-specific adaptations

### 2. Edge Cases
- Unsupported type fallback handling
- Invalid enum/set values
- Extreme precision/scale values
- Special characters in defaults/comments

### 3. Integration Tests
- Full table migration generation
- Multi-database source compatibility
- Laravel migration execution validation

## Dependencies Synchronization

### 1. Provides to Other Tasks
- **task-relationship-handling.md**: Type information for foreign key columns
- **task-file-generation.md**: Formatted column definitions
- **task-ui-integration.md**: Type mapping validation results

### 2. Syncs With Core Implementation
- Uses core timestamp generation
- Integrates with template system
- Shares utility functions

## Success Criteria

### Technical Requirements
- [ ] Maps all DrawDB data types to Laravel equivalents
- [ ] Handles database-specific type variations
- [ ] Generates valid Laravel column methods
- [ ] Preserves all field constraints and modifiers

### Quality Requirements
- [ ] Provides helpful warnings for edge cases
- [ ] Maintains type safety and validation
- [ ] Offers fallback for unsupported types
- [ ] Suggests Laravel-specific improvements

### Integration Requirements
- [ ] Works seamlessly with core implementation
- [ ] Supports all DrawDB source databases
- [ ] Maintains consistency with existing export patterns
- [ ] Provides clear error messages

This type mapping system ensures accurate and comprehensive translation of database schemas while maintaining Laravel migration best practices and DrawDB's architectural patterns.