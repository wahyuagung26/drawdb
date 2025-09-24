# Task: Core Laravel Migrations Implementation

## Overview
Implement the core Laravel migrations export functionality following DrawDB's existing export architecture. This task creates the foundational export system that other tasks will build upon.

## Architecture Integration

### File Structure
```
src/utils/exportAs/laravel.js  # Main Laravel export module (new)
src/utils/exportAs/index.js    # Export registry (update)
```

### Dependencies
- Follows existing `exportAs` pattern (dbml.js, mermaid.js)
- Integrates with `src/data/datatypes.js` for type mapping
- Uses `src/utils/utils.js` for common utilities

## Core Functions

### 1. Main Export Function
```javascript
export function toLaravel(diagram, options = {}) {
  // Process diagram data into Laravel migration format
  // Returns: { tables: [], relationships: [], metadata: {} }
}
```

### 2. Table Migration Generator
```javascript
function generateTableMigration(table, timestamp, options) {
  // Convert DrawDB table to Laravel migration
  // Handles: columns, indexes, primary keys
}
```

### 3. Utility Functions
```javascript
function generateTimestamp(baseTime, offset) {
  // Sequential timestamp generation
}

function sanitizeTableName(tableName) {
  // Laravel naming convention compliance
}

function toPascalCase(string) {
  // Convert to Laravel class naming
}
```

## Data Flow

### Input Processing
```
DrawDB Diagram Object
├── tables[]
│   ├── name
│   ├── fields[]
│   │   ├── name, type, size, default
│   │   ├── primary, unique, notNull
│   │   └── comment
│   ├── indices[]
│   └── color
├── references[]
│   ├── startTableId, endTableId
│   ├── startFieldId, endFieldId
│   └── updateConstraint, deleteConstraint
└── database (mysql, postgres, etc.)
```

### Output Generation
```
Laravel Migration Package
├── migrations[]
│   ├── filename (timestamped)
│   ├── content (PHP migration class)
│   └── type (table|relationship|index)
├── metadata
│   ├── version: "Laravel 12.x"
│   ├── database: source_database
│   └── timestamp: generation_time
```

## Implementation Steps

### Phase 1: Basic Structure
1. Create `src/utils/exportAs/laravel.js`
2. Implement `toLaravel()` main function
3. Add basic table migration generation
4. Implement timestamp utilities

### Phase 2: Core Features
1. Add column type mapping (basic types)
2. Implement primary key handling
3. Add not null and default value support
4. Create migration file template system

### Phase 3: Advanced Table Features
1. Add index generation support
2. Implement unique constraints
3. Add table comments and metadata
4. Support for auto-increment columns

## Template System

### Migration File Template
```php
<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('{{TABLE_NAME}}', function (Blueprint $table) {
{{COLUMNS}}
{{INDEXES}}
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('{{TABLE_NAME}}');
    }
};
```

### Column Template Patterns
```php
// Basic column
$table->{{TYPE}}('{{NAME}}'){{MODIFIERS}};

// With size
$table->{{TYPE}}('{{NAME}}', {{SIZE}}){{MODIFIERS}};

// With precision/scale
$table->{{TYPE}}('{{NAME}}', {{PRECISION}}, {{SCALE}}){{MODIFIERS}};
```

## Testing Strategy

### Unit Tests
- Verify timestamp generation uniqueness
- Test table name sanitization
- Validate basic migration structure
- Check template rendering

### Integration Tests
- Export simple table schemas
- Verify generated PHP syntax
- Test with different database sources
- Validate migration file naming

## Dependencies on Other Tasks

### Provides Foundation For:
- **task-type-mapping.md**: Uses core structure for type conversion
- **task-relationship-handling.md**: Extends with foreign key support
- **task-file-generation.md**: Uses migration generation system
- **task-ui-integration.md**: Provides export function to UI

### Integrates With:
- Existing `exportAs` modules for consistency
- `datatypes.js` for source type information
- `utils.js` for common helper functions

## Success Criteria

### Technical Requirements
- [ ] Generates valid PHP Laravel 12 migration files
- [ ] Maintains unique sequential timestamps
- [ ] Follows Laravel naming conventions
- [ ] Integrates with existing export architecture

### Code Quality
- [ ] Follows DrawDB's JavaScript patterns
- [ ] Uses existing utility functions where possible
- [ ] Maintains consistent error handling
- [ ] Includes JSDoc documentation

### Output Quality
- [ ] Generated migrations execute without errors
- [ ] Migration class names follow Laravel conventions
- [ ] File timestamps ensure proper migration order
- [ ] Down migrations properly reverse up migrations

## File Locations

### New Files
- `src/utils/exportAs/laravel.js` - Core implementation

### Modified Files
- `src/utils/exportAs/index.js` - Add Laravel export registration

### Test Files
- Manual testing with sample DrawDB schemas
- Validation in actual Laravel projects

## Notes

### Architecture Decisions
- Follow existing `dbml.js` structure for consistency
- Use template-based approach for maintainability
- Separate table and relationship migration generation
- Support incremental timestamp generation

### Laravel Compatibility
- Target Laravel 12.x migration format
- Use anonymous class syntax (Laravel 9+)
- Follow Laravel migration best practices
- Support proper up/down migration patterns

This task provides the foundation for the complete Laravel migrations export feature while maintaining consistency with DrawDB's existing export system architecture.