import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Form, Input, Select, Spin, Banner, Checkbox, Progress } from "@douyinfe/semi-ui";
import { testConnection, getDatabases, getTables, importSchema, DATABASE_TYPES } from "../../../api/database";
import { useDiagram } from "../../../hooks";

// Step constants
const STEPS = {
  CONNECTION: 1,
  DATABASE_SELECT: 2,
  TABLE_SELECT: 3,
  IMPORTING: 4,
  SUCCESS: 5
};

export default function DatabaseImportModal({ onModalClose, setTitle }) {
  const { t } = useTranslation();
  const { setTables, setRelationships, setDatabase } = useDiagram();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(STEPS.CONNECTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Connection form data
  const [connectionForm, setConnectionForm] = useState({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "",
    password: "",
    database: ""
  });

  // Step data
  const [availableDatabases, setAvailableDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [databaseSearchTerm, setDatabaseSearchTerm] = useState("");
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filter databases based on search term
  const filteredDatabases = availableDatabases.filter(db =>
    db.name.toLowerCase().includes(databaseSearchTerm.toLowerCase())
  );

  // Filter tables based on search term
  const filteredTables = availableTables.filter(table =>
    table.name.toLowerCase().includes(tableSearchTerm.toLowerCase())
  );

  // Reset state function
  const resetState = () => {
    setCurrentStep(STEPS.CONNECTION);
    setLoading(false);
    setError(null);
    setAvailableDatabases([]);
    setSelectedDatabase("");
    setAvailableTables([]);
    setSelectedTables([]);
    setImportProgress(0);
    setDatabaseSearchTerm("");
    setTableSearchTerm("");
  };

  // Expose reset function to parent
  useEffect(() => {
    if (onModalClose) {
      onModalClose(resetState);
    }
  }, [onModalClose]);

  // Handle connection form changes
  const handleConnectionChange = (field, value) => {
    setConnectionForm(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-set default port based on database type
      if (field === "type") {
        const dbType = DATABASE_TYPES.find(type => type.value === value);
        if (dbType && dbType.defaultPort) {
          updated.port = dbType.defaultPort;
        }
      }

      return updated;
    });
    setError(null);
  };

  // Step 1: Test connection
  const handleTestConnection = async () => {
    if (!connectionForm.username) {
      setError("Username is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await testConnection(connectionForm);

      if (result.success) {
        // If database is specified, skip database selection
        if (connectionForm.database) {
          setSelectedDatabase(connectionForm.database);
          setCurrentStep(STEPS.TABLE_SELECT);
          await loadTables(connectionForm.database);
        } else {
          setCurrentStep(STEPS.DATABASE_SELECT);
          await loadDatabases();
        }
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      setError(error.response?.data?.error || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Load databases
  const loadDatabases = async () => {
    setLoading(true);
    try {
      const result = await getDatabases(connectionForm);
      if (result.success) {
        setAvailableDatabases(result.databases);
      }
    } catch (error) {
      console.error("Failed to load databases:", error);
      setError(error.response?.data?.error || "Failed to load databases");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Load tables
  const loadTables = async (database) => {
    setLoading(true);
    try {
      const result = await getTables(connectionForm, database);
      if (result.success) {
        setAvailableTables(result.tables);
        setCurrentStep(STEPS.TABLE_SELECT);
      }
    } catch (error) {
      console.error("Failed to load tables:", error);
      setError(error.response?.data?.error || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  // Handle database selection
  const handleDatabaseSelect = async (database) => {
    setSelectedDatabase(database);
    await loadTables(database);
  };

  // Handle table selection
  const handleTableToggle = (tableName, checked) => {
    setSelectedTables(prev =>
      checked
        ? [...prev, tableName]
        : prev.filter(t => t !== tableName)
    );
  };

  // Select all/none tables
  const handleSelectAllTables = (checked) => {
    setSelectedTables(checked ? availableTables.map(t => t.name) : []);
  };

  // Step 4: Import schema
  const handleImportSchema = async () => {
    if (selectedTables.length === 0) {
      setError("Please select at least one table");
      return;
    }

    setCurrentStep(STEPS.IMPORTING);
    setImportProgress(0);
    setError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await importSchema(connectionForm, selectedDatabase, selectedTables);

      clearInterval(progressInterval);
      setImportProgress(100);

      if (result.success) {
        // Apply imported data to the diagram
        const { diagramData } = result;
        setDatabase(diagramData.database);
        setTitle(diagramData.title);
        setTables(diagramData.tables);
        setRelationships(diagramData.relationships);

        setCurrentStep(STEPS.SUCCESS);
      }
    } catch (error) {
      console.error("Import failed:", error);
      setError(error.response?.data?.error || "Import failed");
      setCurrentStep(STEPS.TABLE_SELECT);
    }
  };

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === STEPS.DATABASE_SELECT) {
      setCurrentStep(STEPS.CONNECTION);
      // Reset database selection when going back
      setSelectedDatabase("");
      setDatabaseSearchTerm("");
    } else if (currentStep === STEPS.TABLE_SELECT) {
      // Reset selected tables when going back
      setSelectedTables([]);
      setTableSearchTerm("");
      if (connectionForm.database) {
        setCurrentStep(STEPS.CONNECTION);
      } else {
        setCurrentStep(STEPS.DATABASE_SELECT);
      }
    }
    setError(null);
  };

  // Render different steps
  const renderStep = () => {
    switch (currentStep) {
      case STEPS.CONNECTION:
        return (
          <div className="space-y-4">
            <div className="text-md font-semibold mb-4">Database Connection</div>

            <Form layout="vertical" className="gap-4 flex flex-col">
              <div>
                <Form.Label text="Database Type" required />
                <Select
                    value={connectionForm.type}
                    onChange={value => handleConnectionChange("type", value)}
                    style={{ width: "100%" }}
                >
                    {DATABASE_TYPES.map(type => (
                    <Select.Option key={type.value} value={type.value}>
                        {type.label}
                    </Select.Option>
                    ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Form.Label text="Host" required />
                  <Input
                    value={connectionForm.host}
                    onChange={value => handleConnectionChange("host", value)}
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <Form.Label text="Port" />
                  <Input
                    type="number"
                    value={connectionForm.port}
                    onChange={value => handleConnectionChange("port", parseInt(value))}
                    placeholder="3306"
                  />
                </div>
              </div>

              <div>
                <Form.Label text="Username" required />
                <Input
                    value={connectionForm.username}
                    onChange={value => handleConnectionChange("username", value)}
                    placeholder="root"
                />
              </div>

              <div>
                <Form.Label text="Password" />
                <Input
                    type="password"
                    value={connectionForm.password}
                    onChange={value => handleConnectionChange("password", value)}
                    placeholder="password"
                />
              </div>

              <div>
                <Form.Label text="Database (optional)" />
                <Input
                    value={connectionForm.database}
                    onChange={value => handleConnectionChange("database", value)}
                    placeholder="Leave empty to list all databases"
                />
              </div>
            </Form>

            {error && (
              <Banner type="danger" description={error} />
            )}

            <div className="flex justify-end">
              <Button
                theme="solid"
                type="primary"
                loading={loading}
                onClick={handleTestConnection}
              >
                {loading ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        );

      case STEPS.DATABASE_SELECT:
        return (
          <div className="space-y-4">
            <div className="text-md font-semibold mb-4">Select Database</div>

            <Input
              placeholder="Search databases..."
              value={databaseSearchTerm}
              onChange={setDatabaseSearchTerm}
              prefix={<div className="p-2"><i className="fa fa-search" /></div>}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredDatabases.map(db => (
                <div
                  key={db.name}
                  className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDatabaseSelect(db.name)}
                >
                  <div className="font-medium">{db.name}</div>
                  <div className="text-sm text-gray-500">{db.type}</div>
                </div>
              ))}
              {filteredDatabases.length === 0 && databaseSearchTerm && (
                <div className="text-center py-4 text-gray-500">
                  No databases found matching "{databaseSearchTerm}"
                </div>
              )}
            </div>

            {error && (
              <Banner type="danger" description={error} />
            )}

            <div className="flex justify-between">
              <Button onClick={handleBack}>Back</Button>
              <div></div>
            </div>
          </div>
        );

      case STEPS.TABLE_SELECT:
        return (
          <div className="space-y-4">
            <div className="text-md font-semibold mb-4">
              Select Tables from "{selectedDatabase}"
            </div>

            <Input
              placeholder="Search tables..."
              value={tableSearchTerm}
              onChange={setTableSearchTerm}
              prefix={<div className="p-2"><i className="fa fa-search" /></div>}
            />

            <div className="flex justify-between items-center mb-4">
              <Checkbox
                checked={selectedTables.length === availableTables.length && availableTables.length > 0}
                indeterminate={selectedTables.length > 0 && selectedTables.length < availableTables.length}
                onChange={(e) => handleSelectAllTables(e.target.checked)}
              >
                Select All ({selectedTables.length}/{availableTables.length})
              </Checkbox>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredTables.map(table => (
                <div key={table.name} className="flex items-center p-2 border rounded">
                  <Checkbox
                    checked={selectedTables.includes(table.name)}
                    onChange={(e) => handleTableToggle(table.name, e.target.checked)}
                  >
                    <div>
                      <div className="font-medium">{table.name}</div>
                    </div>
                  </Checkbox>
                </div>
              ))}
              {filteredTables.length === 0 && tableSearchTerm && (
                <div className="text-center py-4 text-gray-500">
                  No tables found matching "{tableSearchTerm}"
                </div>
              )}
            </div>

            {error && (
              <Banner type="danger" description={error} />
            )}

            <div className="flex justify-between">
              <Button onClick={handleBack}>Back</Button>
              <Button
                theme="solid"
                type="primary"
                onClick={handleImportSchema}
                disabled={selectedTables.length === 0}
              >
                Import Selected Tables ({selectedTables.length})
              </Button>
            </div>
          </div>
        );

      case STEPS.IMPORTING:
        return (
          <div className="space-y-4 text-center py-8">
            <div className="text-lg font-semibold">Importing Database Schema...</div>
            <Spin size="large" />
            <Progress percent={importProgress} showInfo />
            <div className="text-sm text-gray-500">
              Processing {selectedTables.length} tables from "{selectedDatabase}"
            </div>
          </div>
        );

      case STEPS.SUCCESS:
        return (
          <div className="space-y-3 text-center py-4">
            <div className="mb-2">
              <div className="w-1/4 aspect-square bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-check text-green-600 text-4xl"></i>
              </div>
              <div className="text-lg font-semibold text-green-600 mb-1">Import Successful!</div>
              <div className="text-sm text-gray-600 mb-3">
                Successfully imported {selectedTables.length} tables from "{selectedDatabase}"
              </div>
            </div>
            <Banner
              type="success"
              description="Database schema has been imported and is now available in your diagram."
              className="text-left"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-96">
      {renderStep()}
    </div>
  );
}