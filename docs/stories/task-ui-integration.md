# Task: UI Integration for Laravel Migrations Export

## Overview
Integrate Laravel migrations export functionality into DrawDB's existing user interface, following the established export patterns and UI components. This task creates the user-facing interface for the Laravel export feature.

## Architecture Integration

### Dependencies
- **Extends**: `task-core-implementation.md` - Uses core Laravel export functions
- **Utilizes**: `task-type-mapping.md` - Displays type mapping validation
- **Integrates**: `src/components/EditorHeader/ControlPanel.jsx` - Main export UI
- **Follows**: Semi-UI component patterns used throughout DrawDB

### File Structure
```
src/components/EditorHeader/
├── ControlPanel.jsx                    # Main toolbar (modify)
├── modals/
│   └── LaravelExportModal.jsx         # Export configuration modal (new)
└── LaravelExportModal/
    ├── ExportOptions.jsx              # Export configuration (new)
    ├── ValidationResults.jsx          # Type mapping warnings (new)
    └── PreviewPanel.jsx               # Migration preview (new)
```

## UI Component Architecture

### 1. ControlPanel Integration
```jsx
// In src/components/EditorHeader/ControlPanel.jsx
import { toLaravel } from "../../utils/exportAs/laravel";

export default function ControlPanel() {
  // ... existing code ...

  const exportOptions = [
    // ... existing export options ...
    {
      key: "laravel",
      label: t("export.laravel_migrations"),
      icon: <IconLaravel />, // Custom Laravel icon
      onClick: () => openLaravelExportModal(),
    },
  ];

  const openLaravelExportModal = () => {
    setModal({
      type: "LARAVEL_EXPORT",
      data: {
        diagram: diagramData,
        database: database,
      },
    });
  };

  // ... rest of component
}
```

### 2. Export Modal Component
```jsx
// src/components/EditorHeader/modals/LaravelExportModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Toast } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { toLaravel } from "../../../utils/exportAs/laravel";
import ExportOptions from "./LaravelExportModal/ExportOptions";
import ValidationResults from "./LaravelExportModal/ValidationResults";
import PreviewPanel from "./LaravelExportModal/PreviewPanel";

export default function LaravelExportModal({ modal, setModal }) {
  const { t } = useTranslation();
  const [exportConfig, setExportConfig] = useState({
    format: "multiple_files", // "single_file" | "multiple_files"
    includeForeignKeys: true,
    includeIndexes: true,
    includeTimestamps: true,
    includeSoftDeletes: false,
    namingConvention: "laravel_standard",
    customPrefix: "",
    includeComments: true,
  });

  const [validationResults, setValidationResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate preview when config changes
  useEffect(() => {
    if (modal.data?.diagram) {
      generatePreview();
    }
  }, [exportConfig, modal.data]);

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      const result = toLaravel(modal.data.diagram, {
        ...exportConfig,
        sourceDatabase: modal.data.database,
        preview: true, // Only generate first few migrations
      });

      setPreviewData(result);
      setValidationResults(result.validation || {});
    } catch (error) {
      Toast.error(t("export.generation_error") + ": " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      const result = toLaravel(modal.data.diagram, {
        ...exportConfig,
        sourceDatabase: modal.data.database,
      });

      if (exportConfig.format === "multiple_files") {
        downloadAsZip(result);
      } else {
        downloadAsSingleFile(result);
      }

      setModal(null);
      Toast.success(t("export.success"));
    } catch (error) {
      Toast.error(t("export.error") + ": " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      title={t("export.laravel_migrations")}
      visible={modal.type === "LARAVEL_EXPORT"}
      onCancel={() => setModal(null)}
      width={800}
      footer={
        <div className="flex justify-between">
          <Button onClick={() => setModal(null)}>
            {t("cancel")}
          </Button>
          <Button
            type="primary"
            onClick={handleExport}
            loading={isGenerating}
            disabled={validationResults?.errors?.length > 0}
          >
            {t("export.download")}
          </Button>
        </div>
      }
    >
      <div className="laravel-export-modal">
        <ExportOptions
          config={exportConfig}
          onConfigChange={setExportConfig}
          diagram={modal.data?.diagram}
        />

        {validationResults && (
          <ValidationResults
            results={validationResults}
            sourceDatabase={modal.data?.database}
          />
        )}

        <PreviewPanel
          previewData={previewData}
          isGenerating={isGenerating}
          config={exportConfig}
        />
      </div>
    </Modal>
  );
}
```

### 3. Export Options Component
```jsx
// src/components/EditorHeader/LaravelExportModal/ExportOptions.jsx
import React from "react";
import { Form, Switch, Select, Input, Card, Divider } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";

export default function ExportOptions({ config, onConfigChange, diagram }) {
  const { t } = useTranslation();

  const updateConfig = (key, value) => {
    onConfigChange({ ...config, [key]: value });
  };

  const formatOptions = [
    { value: "multiple_files", label: t("export.multiple_files") },
    { value: "single_file", label: t("export.single_file") },
  ];

  const namingOptions = [
    { value: "laravel_standard", label: t("export.laravel_standard") },
    { value: "descriptive", label: t("export.descriptive") },
    { value: "custom", label: t("export.custom") },
  ];

  return (
    <Card title={t("export.options")} className="mb-4">
      <Form layout="vertical">
        <Form.Select
          field="format"
          label={t("export.format")}
          value={config.format}
          onChange={(value) => updateConfig("format", value)}
          optionList={formatOptions}
          helpText={t("export.format_help")}
        />

        <Divider margin="16px" />

        <div className="grid grid-cols-2 gap-4">
          <Form.Switch
            field="includeForeignKeys"
            label={t("export.include_foreign_keys")}
            checked={config.includeForeignKeys}
            onChange={(checked) => updateConfig("includeForeignKeys", checked)}
          />

          <Form.Switch
            field="includeIndexes"
            label={t("export.include_indexes")}
            checked={config.includeIndexes}
            onChange={(checked) => updateConfig("includeIndexes", checked)}
          />

          <Form.Switch
            field="includeTimestamps"
            label={t("export.include_timestamps")}
            checked={config.includeTimestamps}
            onChange={(checked) => updateConfig("includeTimestamps", checked)}
            helpText={t("export.timestamps_help")}
          />

          <Form.Switch
            field="includeSoftDeletes"
            label={t("export.include_soft_deletes")}
            checked={config.includeSoftDeletes}
            onChange={(checked) => updateConfig("includeSoftDeletes", checked)}
          />
        </div>

        <Divider margin="16px" />

        <Form.Select
          field="namingConvention"
          label={t("export.naming_convention")}
          value={config.namingConvention}
          onChange={(value) => updateConfig("namingConvention", value)}
          optionList={namingOptions}
        />

        {config.namingConvention === "custom" && (
          <Form.Input
            field="customPrefix"
            label={t("export.custom_prefix")}
            value={config.customPrefix}
            onChange={(value) => updateConfig("customPrefix", value)}
            placeholder="my_app_"
          />
        )}

        <Form.Switch
          field="includeComments"
          label={t("export.include_comments")}
          checked={config.includeComments}
          onChange={(checked) => updateConfig("includeComments", checked)}
        />
      </Form>
    </Card>
  );
}
```

### 4. Validation Results Component
```jsx
// src/components/EditorHeader/LaravelExportModal/ValidationResults.jsx
import React from "react";
import { Card, Alert, Collapse, Tag } from "@douyinfe/semi-ui";
import { IconWarning, IconError, IconInfo } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";

export default function ValidationResults({ results, sourceDatabase }) {
  const { t } = useTranslation();

  if (!results || (!results.warnings?.length && !results.errors?.length)) {
    return (
      <Alert
        type="success"
        message={t("export.validation_success")}
        icon={<IconInfo />}
        className="mb-4"
      />
    );
  }

  return (
    <Card title={t("export.validation_results")} className="mb-4">
      {results.errors?.length > 0 && (
        <Alert
          type="error"
          message={t("export.validation_errors")}
          description={
            <ul className="mt-2 list-disc list-inside">
              {results.errors.map((error, index) => (
                <li key={index} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          }
          className="mb-3"
        />
      )}

      {results.warnings?.length > 0 && (
        <Collapse className="mb-3">
          <Collapse.Panel
            header={
              <div className="flex items-center">
                <IconWarning className="mr-2 text-yellow-500" />
                <span>{t("export.validation_warnings")}</span>
                <Tag color="yellow" className="ml-2">
                  {results.warnings.length}
                </Tag>
              </div>
            }
            itemKey="warnings"
          >
            <ul className="list-disc list-inside">
              {results.warnings.map((warning, index) => (
                <li key={index} className="text-sm mb-1">
                  {warning}
                </li>
              ))}
            </ul>
          </Collapse.Panel>
        </Collapse>
      )}

      {results.suggestions?.length > 0 && (
        <Alert
          type="info"
          message={t("export.laravel_suggestions")}
          description={
            <ul className="mt-2 list-disc list-inside">
              {results.suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm">
                  {suggestion.message}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </Card>
  );
}
```

### 5. Preview Panel Component
```jsx
// src/components/EditorHeader/LaravelExportModal/PreviewPanel.jsx
import React, { useState } from "react";
import { Card, Tabs, Skeleton, Button, Tooltip } from "@douyinfe/semi-ui";
import { IconCopy, IconDownload } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function PreviewPanel({ previewData, isGenerating, config }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("0");

  const copyToClipboard = (content) => {
    navigator.clipboard.writeText(content);
    // Toast notification would be added here
  };

  if (isGenerating) {
    return (
      <Card title={t("export.preview")} className="mb-4">
        <Skeleton loading active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  if (!previewData?.tables?.length) {
    return (
      <Card title={t("export.preview")} className="mb-4">
        <div className="text-center py-8 text-gray-500">
          {t("export.no_preview")}
        </div>
      </Card>
    );
  }

  const migrationTabs = previewData.tables.slice(0, 3).map((migration, index) => ({
    tab: migration.filename,
    itemKey: index.toString(),
    content: (
      <div className="relative">
        <div className="flex justify-end mb-2">
          <Tooltip content={t("export.copy_code")}>
            <Button
              icon={<IconCopy />}
              size="small"
              onClick={() => copyToClipboard(migration.content)}
            />
          </Tooltip>
        </div>
        <SyntaxHighlighter
          language="php"
          style={oneDark}
          className="rounded"
          customStyle={{ maxHeight: "400px", fontSize: "12px" }}
        >
          {migration.content}
        </SyntaxHighlighter>
      </div>
    ),
  }));

  // Add summary tab
  migrationTabs.push({
    tab: t("export.summary"),
    itemKey: "summary",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">{t("export.total_tables")}</div>
            <div className="text-2xl font-bold">{previewData.tables.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">{t("export.relationships")}</div>
            <div className="text-2xl font-bold">{previewData.relationships?.length || 0}</div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">{t("export.migration_files")}</h4>
          <ul className="text-sm space-y-1">
            {previewData.tables.map((migration) => (
              <li key={migration.filename} className="flex justify-between">
                <span className="font-mono">{migration.filename}</span>
                <span className="text-gray-500">{migration.type}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  });

  return (
    <Card title={t("export.preview")} className="mb-4">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabList={migrationTabs}
        lazyRender
      />
    </Card>
  );
}
```

## File Download Integration

### 1. ZIP Download Utility
```javascript
// src/utils/downloadUtils.js (extend existing)
import JSZip from "jszip";

export async function downloadLaravelMigrations(migrations, filename = "laravel_migrations.zip") {
  const zip = new JSZip();

  // Add migration files
  migrations.tables.forEach(migration => {
    zip.file(migration.filename, migration.content);
  });

  // Add relationship migrations
  if (migrations.relationships) {
    migrations.relationships.forEach(migration => {
      zip.file(migration.filename, migration.content);
    });
  }

  // Add README with instructions
  const readme = generateMigrationReadme(migrations);
  zip.file("README.md", readme);

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateMigrationReadme(migrations) {
  return `# Laravel Migrations

Generated from DrawDB on ${new Date().toISOString()}

## Installation Instructions

1. Copy all migration files to your Laravel project's \`database/migrations/\` directory
2. Run migrations: \`php artisan migrate\`

## Files Included

### Table Migrations
${migrations.tables.map(m => `- ${m.filename}`).join('\n')}

### Relationship Migrations
${migrations.relationships?.map(m => `- ${m.filename}`).join('\n') || 'None'}

## Notes

- Migrations are timestamped to ensure proper execution order
- Review foreign key constraints before running migrations
- Backup your database before applying migrations

Generated with DrawDB - Database schema editor
`;
}
```

### 2. Modal State Integration
```javascript
// Integration with existing modal system
// In src/context/ModalContext.js or similar

const modalReducer = (state, action) => {
  switch (action.type) {
    // ... existing cases ...
    case "LARAVEL_EXPORT":
      return {
        ...state,
        type: "LARAVEL_EXPORT",
        data: action.payload,
      };
    // ... other cases ...
  }
};
```

## Internationalization Support

### 1. Translation Keys
```javascript
// Add to translation files
{
  "export": {
    "laravel_migrations": "Laravel Migrations",
    "format": "Export Format",
    "multiple_files": "Multiple Files (Recommended)",
    "single_file": "Single File",
    "include_foreign_keys": "Include Foreign Keys",
    "include_indexes": "Include Indexes",
    "include_timestamps": "Add Laravel Timestamps",
    "include_soft_deletes": "Add Soft Deletes",
    "naming_convention": "Naming Convention",
    "laravel_standard": "Laravel Standard",
    "validation_success": "All validations passed",
    "validation_errors": "The following errors must be resolved:",
    "validation_warnings": "Warnings (export will continue):",
    "laravel_suggestions": "Laravel-specific suggestions:"
  }
}
```

## Testing Strategy

### 1. Component Tests
- Modal opening/closing functionality
- Configuration option changes
- Preview generation
- Export button states

### 2. Integration Tests
- Export option integration with ControlPanel
- Modal state management
- File download functionality
- Error handling and user feedback

### 3. User Experience Tests
- Export workflow completion
- Preview accuracy
- Configuration persistence
- Error message clarity

## Dependencies Synchronization

### 1. Consumes from Other Tasks
- **task-core-implementation.md**: `toLaravel()` function
- **task-type-mapping.md**: Validation results and warnings
- **task-file-generation.md**: Migration file structure

### 2. Integrates with DrawDB Systems
- Modal management system
- Translation system
- Export utilities
- UI component patterns

## Success Criteria

### User Interface Requirements
- [ ] Export option appears in main toolbar dropdown
- [ ] Modal provides comprehensive configuration options
- [ ] Preview shows accurate migration code
- [ ] Download works for both single and multiple file formats

### User Experience Requirements
- [ ] Clear validation messages for errors/warnings
- [ ] Progress indicators during generation
- [ ] Helpful Laravel-specific suggestions
- [ ] Consistent with existing DrawDB UI patterns

### Integration Requirements
- [ ] Follows Semi-UI component patterns
- [ ] Integrates with existing translation system
- [ ] Uses established modal management
- [ ] Maintains DrawDB code style conventions

This UI integration provides a comprehensive and user-friendly interface for Laravel migrations export while maintaining consistency with DrawDB's existing design patterns and user experience.