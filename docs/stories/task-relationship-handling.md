# Task: Laravel Foreign Key Relationship Handling

## Overview
Implement comprehensive foreign key relationship handling for Laravel migrations, converting DrawDB's relationship definitions into proper Laravel migration constraints. This task handles the complex logic of relationship mapping, constraint generation, and migration ordering.

## Architecture Integration

### Dependencies
- **Extends**: `task-core-implementation.md` - Uses core Laravel export structure
- **Integrates**: `task-type-mapping.md` - Ensures compatible column types for relationships
- **Coordinates**: `task-file-generation.md` - Provides relationship migrations for packaging
- **Utilizes**: DrawDB's `diagram.references` structure

### File Structure
```
src/utils/exportAs/laravel/
├── relationshipHandler.js      # Main relationship processing (new)
├── constraintMapper.js         # Constraint type mapping (new)
├── migrationOrderer.js         # Migration dependency ordering (new)
└── relationshipValidator.js    # Relationship validation (new)
```

## Relationship Processing Architecture

### 1. Main Relationship Handler
```javascript
// src/utils/exportAs/laravel/relationshipHandler.js
export class RelationshipHandler {
  constructor(references, tables, options = {}) {
    this.references = references || [];
    this.tables = tables || [];
    this.options = {
      includeForeignKeys: true,
      onUpdateAction: 'restrict', // restrict, cascade, set_null, no_action
      onDeleteAction: 'restrict',
      generateSeparateMigrations: true,
      ...options
    };

    this.constraintMapper = new ConstraintMapper();
    this.migrationOrderer = new MigrationOrderer(tables);
    this.validator = new RelationshipValidator(tables);
  }

  processRelationships() {
    if (!this.options.includeForeignKeys || !this.references.length) {
      return [];
    }

    // Step 1: Validate all relationships
    const validationResults = this.validator.validateAllRelationships(this.references);
    if (validationResults.errors.length > 0) {
      throw new Error(`Relationship validation failed: ${validationResults.errors.join(', ')}`);
    }

    // Step 2: Group relationships by target table
    const groupedRelationships = this.groupRelationshipsByTable();

    // Step 3: Generate foreign key migrations
    const relationshipMigrations = this.generateRelationshipMigrations(groupedRelationships);

    // Step 4: Order migrations properly
    const orderedMigrations = this.migrationOrderer.orderRelationshipMigrations(relationshipMigrations);

    return {
      migrations: orderedMigrations,
      validation: validationResults
    };
  }

  groupRelationshipsByTable() {
    const grouped = new Map();

    this.references.forEach(reference => {
      const targetTable = this.findTableById(reference.startTableId);
      if (!targetTable) return;

      const tableName = targetTable.name;
      if (!grouped.has(tableName)) {
        grouped.set(tableName, []);
      }

      grouped.get(tableName).push(this.processReference(reference));
    });

    return grouped;
  }

  processReference(reference) {
    const startTable = this.findTableById(reference.startTableId);
    const endTable = this.findTableById(reference.endTableId);
    const startField = this.findFieldById(startTable, reference.startFieldId);
    const endField = this.findFieldById(endTable, reference.endFieldId);

    return {
      localTable: startTable.name,
      localColumn: startField.name,
      foreignTable: endTable.name,
      foreignColumn: endField.name,
      onUpdate: this.mapConstraintAction(reference.updateConstraint),
      onDelete: this.mapConstraintAction(reference.deleteConstraint),
      constraintName: this.generateConstraintName(
        startTable.name,
        startField.name,
        endTable.name
      ),
      // Additional metadata
      localTableId: reference.startTableId,
      foreignTableId: reference.endTableId,
      originalReference: reference
    };
  }

  generateRelationshipMigrations(groupedRelationships) {
    const migrations = [];

    for (const [tableName, relationships] of groupedRelationships) {
      if (this.options.generateSeparateMigrations) {
        // Generate separate migration for each table's foreign keys
        migrations.push({
          type: 'foreign_keys',
          tableName: tableName,
          relationships: relationships,
          migrationName: `add_foreign_keys_to_${tableName}`,
          dependencies: relationships.map(r => r.foreignTable)
        });
      } else {
        // Generate individual migration for each relationship
        relationships.forEach(relationship => {
          migrations.push({
            type: 'foreign_key',
            tableName: tableName,
            relationship: relationship,
            migrationName: `add_${relationship.localColumn}_foreign_to_${tableName}`,
            dependencies: [relationship.foreignTable]
          });
        });
      }
    }

    return migrations;
  }

  mapConstraintAction(action) {
    const actionMap = {
      'CASCADE': 'cascade',
      'SET_NULL': 'set null',
      'RESTRICT': 'restrict',
      'NO_ACTION': 'no action',
      'SET_DEFAULT': 'set default'
    };

    return actionMap[action] || this.options.onDeleteAction;
  }

  generateConstraintName(localTable, localColumn, foreignTable) {
    // Laravel convention: table_column_foreign
    return `${localTable}_${localColumn}_foreign`;
  }
}
```

### 2. Constraint Mapping System
```javascript
// src/utils/exportAs/laravel/constraintMapper.js
export class ConstraintMapper {
  constructor() {
    this.supportedActions = ['cascade', 'restrict', 'set null', 'no action'];
  }

  generateForeignKeyDefinition(relationship) {
    const {
      localColumn,
      foreignTable,
      foreignColumn,
      onUpdate,
      onDelete,
      constraintName
    } = relationship;

    // Laravel 12 modern syntax
    if (this.isConventionalForeignKey(relationship)) {
      return this.generateConventionalForeignKey(relationship);
    } else {
      return this.generateExplicitForeignKey(relationship);
    }
  }

  isConventionalForeignKey(relationship) {
    // Check if this follows Laravel conventions (id column, table_id naming)
    return (
      relationship.foreignColumn === 'id' &&
      relationship.localColumn === `${relationship.foreignTable.replace(/s$/, '')}_id`
    );
  }

  generateConventionalForeignKey(relationship) {
    // Use Laravel's shorthand syntax
    const { localColumn, foreignTable, onUpdate, onDelete } = relationship;

    let definition = `$table->foreignId('${localColumn}')->constrained('${foreignTable}')`;

    if (onUpdate && onUpdate !== 'restrict') {
      definition += `->onUpdate('${onUpdate}')`;
    }

    if (onDelete && onDelete !== 'restrict') {
      definition += `->onDelete('${onDelete}')`;
    }

    return definition + ';';
  }

  generateExplicitForeignKey(relationship) {
    // Use explicit foreign key syntax
    const {
      localColumn,
      foreignTable,
      foreignColumn,
      onUpdate,
      onDelete,
      constraintName
    } = relationship;

    let definition = `$table->foreign('${localColumn}', '${constraintName}')\n`;
    definition += `              ->references('${foreignColumn}')\n`;
    definition += `              ->on('${foreignTable}')`;

    if (onUpdate && onUpdate !== 'restrict') {
      definition += `\n              ->onUpdate('${onUpdate}')`;
    }

    if (onDelete && onDelete !== 'restrict') {
      definition += `\n              ->onDelete('${onDelete}')`;
    }

    return definition + ';';
  }

  generateDropForeignKeyStatement(relationship) {
    const { constraintName, localColumn } = relationship;

    // Laravel provides multiple ways to drop foreign keys
    return [
      `$table->dropForeign('${constraintName}');`,
      `// Alternative: $table->dropForeign(['${localColumn}']);`
    ].join('\n        ');
  }
}
```

### 3. Migration Ordering System
```javascript
// src/utils/exportAs/laravel/migrationOrderer.js
export class MigrationOrderer {
  constructor(tables) {
    this.tables = tables;
    this.dependencyGraph = new Map();
  }

  orderRelationshipMigrations(relationshipMigrations) {
    // Build dependency graph
    this.buildDependencyGraph(relationshipMigrations);

    // Perform topological sort
    const ordered = this.topologicalSort(relationshipMigrations);

    return ordered;
  }

  buildDependencyGraph(migrations) {
    migrations.forEach(migration => {
      const tableName = migration.tableName;
      const dependencies = migration.dependencies || [];

      this.dependencyGraph.set(tableName, {
        migration,
        dependencies,
        dependents: []
      });
    });

    // Build reverse dependencies (dependents)
    for (const [tableName, node] of this.dependencyGraph) {
      node.dependencies.forEach(depTable => {
        const depNode = this.dependencyGraph.get(depTable);
        if (depNode) {
          depNode.dependents.push(tableName);
        }
      });
    }
  }

  topologicalSort(migrations) {
    const visited = new Set();
    const visiting = new Set();
    const result = [];

    const visit = (migration) => {
      if (visiting.has(migration.tableName)) {
        throw new Error(`Circular dependency detected involving table: ${migration.tableName}`);
      }

      if (visited.has(migration.tableName)) {
        return;
      }

      visiting.add(migration.tableName);

      // Visit dependencies first
      const node = this.dependencyGraph.get(migration.tableName);
      if (node) {
        node.dependencies.forEach(depTableName => {
          const depMigration = migrations.find(m => m.tableName === depTableName);
          if (depMigration) {
            visit(depMigration);
          }
        });
      }

      visiting.delete(migration.tableName);
      visited.add(migration.tableName);
      result.push(migration);
    };

    migrations.forEach(migration => {
      if (!visited.has(migration.tableName)) {
        visit(migration);
      }
    });

    return result;
  }
}
```

### 4. Relationship Validation System
```javascript
// src/utils/exportAs/laravel/relationshipValidator.js
export class RelationshipValidator {
  constructor(tables) {
    this.tables = tables;
    this.tableMap = new Map(tables.map(t => [t.id, t]));
  }

  validateAllRelationships(references) {
    const results = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    references.forEach((reference, index) => {
      const validation = this.validateSingleRelationship(reference, index);
      results.errors.push(...validation.errors);
      results.warnings.push(...validation.warnings);
      results.suggestions.push(...validation.suggestions);
    });

    // Check for circular dependencies
    const circularCheck = this.checkCircularDependencies(references);
    results.errors.push(...circularCheck.errors);
    results.warnings.push(...circularCheck.warnings);

    return results;
  }

  validateSingleRelationship(reference, index) {
    const results = { errors: [], warnings: [], suggestions: [] };

    // Validate table existence
    const startTable = this.tableMap.get(reference.startTableId);
    const endTable = this.tableMap.get(reference.endTableId);

    if (!startTable) {
      results.errors.push(`Relationship ${index}: Start table not found (ID: ${reference.startTableId})`);
      return results;
    }

    if (!endTable) {
      results.errors.push(`Relationship ${index}: End table not found (ID: ${reference.endTableId})`);
      return results;
    }

    // Validate field existence
    const startField = startTable.fields.find(f => f.id === reference.startFieldId);
    const endField = endTable.fields.find(f => f.id === reference.endFieldId);

    if (!startField) {
      results.errors.push(`Relationship ${index}: Start field not found in table ${startTable.name}`);
      return results;
    }

    if (!endField) {
      results.errors.push(`Relationship ${index}: End field not found in table ${endTable.name}`);
      return results;
    }

    // Validate type compatibility
    const typeCompatibility = this.validateTypeCompatibility(startField, endField);
    if (!typeCompatibility.compatible) {
      results.errors.push(`Relationship ${index}: Type mismatch between ${startTable.name}.${startField.name} (${startField.type}) and ${endTable.name}.${endField.name} (${endField.type})`);
    }

    // Laravel-specific validations
    this.validateLaravelConventions(reference, startTable, endTable, startField, endField, results);

    return results;
  }

  validateTypeCompatibility(startField, endField) {
    // Define compatible type groups
    const typeGroups = {
      integers: ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'],
      strings: ['VARCHAR', 'CHAR', 'TEXT'],
      decimals: ['DECIMAL', 'FLOAT', 'DOUBLE'],
      dates: ['DATE', 'DATETIME', 'TIMESTAMP'],
      special: ['UUID', 'JSON', 'BOOLEAN']
    };

    // Find which group each type belongs to
    const startGroup = Object.keys(typeGroups).find(group =>
      typeGroups[group].includes(startField.type)
    );
    const endGroup = Object.keys(typeGroups).find(group =>
      typeGroups[group].includes(endField.type)
    );

    return {
      compatible: startGroup === endGroup,
      startGroup,
      endGroup
    };
  }

  validateLaravelConventions(reference, startTable, endTable, startField, endField, results) {
    // Check if foreign key follows Laravel naming convention
    const expectedForeignKeyName = `${endTable.name.replace(/s$/, '')}_id`;
    if (startField.name !== expectedForeignKeyName) {
      results.suggestions.push(
        `Consider renaming ${startTable.name}.${startField.name} to ${expectedForeignKeyName} for Laravel convention`
      );
    }

    // Check if referencing primary key
    if (!endField.primary) {
      results.warnings.push(
        `Foreign key ${startTable.name}.${startField.name} references non-primary key ${endTable.name}.${endField.name}`
      );
    }

    // Check for missing indexes
    if (!startField.index && !startField.primary) {
      results.suggestions.push(
        `Consider adding an index to ${startTable.name}.${startField.name} for foreign key performance`
      );
    }

    // Validate constraint actions
    const validActions = ['CASCADE', 'SET_NULL', 'RESTRICT', 'NO_ACTION'];
    if (reference.updateConstraint && !validActions.includes(reference.updateConstraint)) {
      results.warnings.push(`Invalid update constraint: ${reference.updateConstraint}`);
    }
    if (reference.deleteConstraint && !validActions.includes(reference.deleteConstraint)) {
      results.warnings.push(`Invalid delete constraint: ${reference.deleteConstraint}`);
    }
  }

  checkCircularDependencies(references) {
    const results = { errors: [], warnings: [] };
    const graph = new Map();

    // Build adjacency list
    references.forEach(ref => {
      const startTable = this.tableMap.get(ref.startTableId);
      const endTable = this.tableMap.get(ref.endTableId);

      if (startTable && endTable) {
        if (!graph.has(startTable.name)) {
          graph.set(startTable.name, []);
        }
        graph.get(startTable.name).push(endTable.name);
      }
    });

    // Detect cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node, path = []) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat([node]);
        results.errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor, [...path])) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const [node] of graph) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }

    return results;
  }
}
```

## Template Integration

### 1. Foreign Key Migration Template
```javascript
// Integration with template engine
generateForeignKeyMigration(migrationData) {
  const { tableName, relationships, className } = migrationData;

  const foreignKeyStatements = relationships.map(rel =>
    this.constraintMapper.generateForeignKeyDefinition(rel)
  ).join('\n            ');

  const dropStatements = relationships.map(rel =>
    this.constraintMapper.generateDropForeignKeyStatement(rel)
  ).join('\n        ');

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
```

### 2. Generated Output Examples
```php
// Example: Conventional foreign key
$table->foreignId('user_id')->constrained()->onDelete('cascade');

// Example: Explicit foreign key
$table->foreign('author_id', 'posts_author_id_foreign')
      ->references('id')
      ->on('users')
      ->onUpdate('cascade')
      ->onDelete('set null');

// Example: Multiple foreign keys in one migration
Schema::table('posts', function (Blueprint $table) {
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->foreignId('category_id')->constrained()->onDelete('restrict');
    $table->foreign('tag_id')->references('id')->on('tags')->onDelete('set null');
});
```

## Integration with Other Tasks

### 1. Core Implementation Integration
```javascript
// Enhanced relationship processing in main export
export function toLaravel(diagram, options = {}) {
  // ... existing code ...

  // Process relationships
  const relationshipHandler = new RelationshipHandler(
    diagram.references,
    diagram.tables,
    options
  );

  const relationshipResult = relationshipHandler.processRelationships();

  return {
    tables: tableMigrations,
    relationships: relationshipResult.migrations,
    validation: {
      ...existingValidation,
      relationships: relationshipResult.validation
    }
  };
}
```

### 2. File Generation Coordination
```javascript
// Coordinate timestamp ordering between table and relationship migrations
const timestampManager = new TimestampManager();

// Generate table migrations first
const tableMigrations = tables.map(table => ({
  ...generateTableMigration(table),
  timestamp: timestampManager.getNextTimestamp()
}));

// Then generate relationship migrations
const relationshipMigrations = relationships.map(rel => ({
  ...generateRelationshipMigration(rel),
  timestamp: timestampManager.getNextTimestamp()
}));
```

## Testing Strategy

### 1. Relationship Processing Tests
- Reference validation and error handling
- Type compatibility checking
- Circular dependency detection
- Laravel convention validation

### 2. Migration Generation Tests
- Foreign key syntax accuracy
- Constraint action mapping
- Migration ordering correctness
- Template rendering validation

### 3. Integration Tests
- Complete workflow with relationships
- Complex schema with multiple foreign keys
- Error handling and recovery
- Performance with large relationship sets

## Success Criteria

### Technical Requirements
- [ ] Processes all DrawDB relationship types correctly
- [ ] Generates valid Laravel foreign key constraints
- [ ] Handles circular dependency detection
- [ ] Maintains proper migration ordering

### Quality Requirements
- [ ] Provides comprehensive validation and error messages
- [ ] Suggests Laravel best practices and conventions
- [ ] Handles edge cases gracefully
- [ ] Maintains referential integrity

### Integration Requirements
- [ ] Seamlessly integrates with core implementation
- [ ] Coordinates with file generation system
- [ ] Provides validation results to UI
- [ ] Follows DrawDB architectural patterns

This relationship handling system ensures that all foreign key relationships from DrawDB schemas are properly converted to Laravel migration constraints while maintaining referential integrity and following Laravel best practices.