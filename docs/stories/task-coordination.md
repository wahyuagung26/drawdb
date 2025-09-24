# Task Coordination: Laravel Migrations Export

## Overview
This document ensures all Laravel migrations export tasks are properly synchronized, follow DrawDB's architectural patterns, and work together seamlessly. It serves as the master coordination guide for implementation.

## Task Dependencies & Execution Order

### Phase 1: Foundation (Parallel Development)
1. **task-core-implementation.md**
   - **Priority**: Critical Path
   - **Dependencies**: None
   - **Outputs**: Core export structure, timestamp utilities, basic templates
   - **Integration Points**: Provides foundation for all other tasks

2. **task-type-mapping.md**
   - **Priority**: Critical Path
   - **Dependencies**: Requires core structure from task 1
   - **Outputs**: Type conversion system, validation logic
   - **Integration Points**: Used by core implementation and relationship handling

### Phase 2: Advanced Features (Sequential Development)
3. **task-relationship-handling.md**
   - **Priority**: High
   - **Dependencies**: Core implementation + Type mapping
   - **Outputs**: Foreign key constraint system, migration ordering
   - **Integration Points**: Provides relationship migrations to file generation

4. **task-file-generation.md**
   - **Priority**: High
   - **Dependencies**: Core + Type mapping + Relationship handling
   - **Outputs**: Template engine, file packaging, ZIP creation
   - **Integration Points**: Consumes all previous outputs, provides files to UI

### Phase 3: User Interface (Final Integration)
5. **task-ui-integration.md**
   - **Priority**: Medium
   - **Dependencies**: All previous tasks
   - **Outputs**: UI components, modal system, user workflow
   - **Integration Points**: Uses all backend functionality

## Architectural Synchronization

### 1. DrawDB Pattern Compliance

#### Export System Pattern
```javascript
// All tasks follow this pattern established in existing exportAs modules:
export function toLaravel(diagram, options = {}) {
  // Consistent with dbml.js, mermaid.js, documentation.js
  return processedResult;
}
```

#### File Structure Alignment
```
src/utils/exportAs/
├── dbml.js           # Existing pattern
├── mermaid.js        # Existing pattern
├── documentation.js  # Existing pattern
└── laravel.js        # New - follows same pattern
    ├── core functions
    ├── type mapping
    ├── relationships
    └── file generation
```

#### Component Integration Pattern
```jsx
// UI follows existing ControlPanel.jsx pattern:
const exportOptions = [
  { key: "sql", ... },      // Existing
  { key: "dbml", ... },     // Existing
  { key: "laravel", ... },  // New - same structure
];
```

### 2. Data Flow Synchronization

#### Diagram Object Structure
```javascript
// All tasks must handle this consistent structure:
const diagramStructure = {
  tables: [
    {
      id: string,
      name: string,
      fields: [
        {
          id: string,
          name: string,
          type: string,
          size: number,
          default: any,
          notNull: boolean,
          primary: boolean,
          unique: boolean,
          increment: boolean,
          comment: string
        }
      ],
      indices: [...],
      color: string
    }
  ],
  references: [
    {
      id: string,
      startTableId: string,
      endTableId: string,
      startFieldId: string,
      endFieldId: string,
      updateConstraint: string,
      deleteConstraint: string
    }
  ],
  database: string // mysql, postgres, sqlite, etc.
};
```

#### Error Handling Pattern
```javascript
// Consistent error handling across all tasks:
try {
  const result = processFunction(input);
  return {
    success: true,
    data: result,
    warnings: [],
    suggestions: []
  };
} catch (error) {
  return {
    success: false,
    error: error.message,
    warnings: [],
    suggestions: []
  };
}
```

### 3. Integration Point Specifications

#### Core → Type Mapping
```javascript
// Core provides structure, Type Mapping enhances:
function generateTableMigration(table) {
  const columns = table.fields.map(field => {
    const typeMapping = mapDrawDBTypeToLaravel(field, database);
    return {
      ...field,
      laravelMethod: typeMapping.type,
      parameters: typeMapping.parameters,
      modifiers: typeMapping.modifiers
    };
  });
}
```

#### Type Mapping → Relationship Handling
```javascript
// Type mapping validates compatibility:
const typeCompatibility = validateTypeCompatibility(startField, endField);
if (!typeCompatibility.compatible) {
  results.errors.push(`Type mismatch: ${startField.type} vs ${endField.type}`);
}
```

#### Relationship → File Generation
```javascript
// Relationship handling provides ordered migrations:
const orderedMigrations = [
  ...tableMigrations,     // From core + type mapping
  ...relationshipMigrations, // From relationship handling
].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
```

#### All → UI Integration
```javascript
// UI coordinates everything:
const exportLaravelMigrations = async () => {
  const result = await toLaravel(diagram, options);
  if (result.success) {
    downloadMigrationFiles(result.data);
  } else {
    showErrorModal(result.error);
  }
};
```

## Shared Utilities & Constants

### 1. Common Type Definitions
```javascript
// src/utils/exportAs/laravel/types.js (shared by all tasks)
export const LaravelColumnTypes = {
  INTEGER: 'integer',
  BIGINT: 'bigInteger',
  STRING: 'string',
  TEXT: 'text',
  // ... complete mapping
};

export const LaravelModifiers = {
  NULLABLE: 'nullable()',
  UNIQUE: 'unique()',
  INDEX: 'index()',
  // ... complete list
};

export const ConstraintActions = {
  CASCADE: 'cascade',
  RESTRICT: 'restrict',
  SET_NULL: 'set null',
  NO_ACTION: 'no action'
};
```

### 2. Shared Validation Functions
```javascript
// src/utils/exportAs/laravel/validation.js
export function validateTableName(name) {
  // Shared validation logic
}

export function validateColumnName(name) {
  // Shared validation logic
}

export function sanitizeIdentifier(identifier) {
  // Shared sanitization logic
}
```

### 3. Common Template Helpers
```javascript
// src/utils/exportAs/laravel/templateHelpers.js
export function toPascalCase(str) {
  // Used by multiple tasks for class names
}

export function toSnakeCase(str) {
  // Used for table/column naming
}

export function escapePhpString(str) {
  // Used in template generation
}
```

## Testing Coordination

### 1. Shared Test Data
```javascript
// tests/fixtures/laravel-export-fixtures.js
export const sampleDiagram = {
  tables: [...],
  references: [...],
  database: 'mysql'
};

export const expectedOutputs = {
  tableMigrations: [...],
  relationshipMigrations: [...],
  // Expected results for each task
};
```

### 2. Integration Test Suite
```javascript
// tests/integration/laravel-export.test.js
describe('Laravel Export Integration', () => {
  test('complete workflow: diagram → migrations', () => {
    // Test full pipeline
  });

  test('error handling across all tasks', () => {
    // Test error propagation
  });

  test('type compatibility across tasks', () => {
    // Test data consistency
  });
});
```

### 3. Task-Specific Test Requirements
- **Core**: Basic structure, timestamp generation
- **Type Mapping**: All DrawDB types → Laravel methods
- **Relationships**: Foreign key generation, circular dependency detection
- **File Generation**: Template rendering, ZIP creation
- **UI**: User workflow, error display, download functionality

## Implementation Timeline

### Week 1: Foundation
- [ ] Complete `task-core-implementation.md`
- [ ] Set up shared utilities and types
- [ ] Create basic test fixtures
- [ ] Begin `task-type-mapping.md`

### Week 2: Core Features
- [ ] Complete `task-type-mapping.md`
- [ ] Begin `task-relationship-handling.md`
- [ ] Integration testing between Core and Type Mapping
- [ ] Begin `task-file-generation.md`

### Week 3: Advanced Features & Integration
- [ ] Complete `task-relationship-handling.md`
- [ ] Complete `task-file-generation.md`
- [ ] Begin `task-ui-integration.md`
- [ ] End-to-end testing

### Week 4: UI & Polish
- [ ] Complete `task-ui-integration.md`
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Documentation and examples

## Quality Assurance Checkpoints

### Code Quality
- [ ] All tasks follow DrawDB's JavaScript patterns
- [ ] ESLint passes for all new code
- [ ] Consistent error handling patterns
- [ ] JSDoc documentation for public functions

### Integration Quality
- [ ] Data flows correctly between all tasks
- [ ] No circular dependencies between modules
- [ ] Consistent API contracts
- [ ] Proper error propagation

### Output Quality
- [ ] Generated migrations execute without errors in Laravel
- [ ] All DrawDB features are represented accurately
- [ ] Laravel best practices are followed
- [ ] Performance is acceptable for large schemas

## Risk Mitigation

### Technical Risks
1. **Laravel Version Compatibility**
   - Mitigation: Target Laravel 12 stable features only
   - Validation: Test with actual Laravel 12 projects

2. **Complex Relationship Mapping**
   - Mitigation: Extensive validation and error handling
   - Validation: Test with complex schema samples

3. **Type Mapping Accuracy**
   - Mitigation: Comprehensive mapping table with fallbacks
   - Validation: Test all DrawDB type combinations

### Integration Risks
1. **Task Synchronization**
   - Mitigation: Clear API contracts between tasks
   - Validation: Integration tests at each phase

2. **DrawDB Pattern Compliance**
   - Mitigation: Regular code reviews against existing patterns
   - Validation: Consistent with existing export modules

## Success Metrics

### Technical Metrics
- [ ] 100% of DrawDB features exportable to Laravel
- [ ] Generated migrations execute without errors
- [ ] Export time < 5 seconds for schemas with 30+ tables

### Integration Metrics
- [ ] All tasks work together seamlessly
- [ ] No breaking changes to existing DrawDB functionality
- [ ] Consistent user experience with existing exports

### Code Quality Metrics
- [ ] ESLint passes with 0 warnings
- [ ] Test coverage > 90% for all task modules
- [ ] Documentation coverage for all public APIs

This coordination document ensures all tasks work together cohesively while maintaining DrawDB's architectural integrity and providing a high-quality Laravel migrations export feature.