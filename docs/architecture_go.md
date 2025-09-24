# Go Fiber + GORM Architecture Documentation

## Overview

This document outlines the complete Go architecture for migrating the DrawDB backend from Node.js/Express to Go Fiber + GORM with feature-based architecture. It includes detailed API contracts, business processes, and architectural patterns to ensure 100% compatibility between Node.js and Go implementations.

## Architecture Structure

### Feature-Based Organization

```
server-go/
├── cmd/
│   └── api/
│       └── main.go                  # Application entry point
├── internal/
│   ├── features/
│   │   ├── database/                # Database import feature
│   │   │   ├── handlers/
│   │   │   │   └── database_handler.go
│   │   │   ├── services/
│   │   │   │   └── database_service.go
│   │   │   ├── models/
│   │   │   │   ├── connection.go
│   │   │   │   ├── schema.go
│   │   │   │   └── diagram.go
│   │   │   └── routes/
│   │   │       └── database_routes.go
│   │   └── gists/                   # File sharing feature
│   │       ├── handlers/
│   │       │   └── gists_handler.go
│   │       ├── services/
│   │       │   └── gists_service.go
│   │       ├── models/
│   │       │   └── gist.go
│   │       └── routes/
│   │           └── gists_routes.go
│   ├── middleware/                  # Shared middleware
│   │   ├── cors.go
│   │   ├── session.go
│   │   ├── logging.go
│   │   └── error_handler.go
│   ├── config/                      # Configuration management
│   │   ├── config.go
│   │   ├── database.go
│   │   └── session.go
│   └── utils/                       # Shared utilities
│       ├── response.go
│       ├── validation.go
│       └── dbml_converter.go
├── pkg/                            # Public packages
│   ├── dbml/                       # DBML processing
│   │   ├── parser.go
│   │   └── generator.go
│   └── response/                   # Standardized API responses
│       └── response.go
├── storage/                        # File storage (matching Node.js)
│   └── gists/
└── go.mod                          # Go modules
```

## Core Architectural Patterns

### 1. Feature-Based Architecture
Each feature (database, gists) is self-contained with its own:
- **Handlers**: HTTP request/response logic
- **Services**: Business logic and external integrations
- **Models**: Data structures and validation
- **Routes**: Route definitions and middleware

### 2. Dependency Injection
```go
// internal/app/app.go
type App struct {
    fiber         *fiber.App
    config        *config.Config
    dbService     database.Service
    gistsService  gists.Service
    sessionStore  session.Store
}

func NewApp(cfg *config.Config) *App {
    app := &App{
        fiber:  fiber.New(),
        config: cfg,
    }

    app.setupServices()
    app.setupMiddleware()
    app.setupRoutes()

    return app
}
```

### 3. Interface-Based Design
```go
// Database service interface
type DatabaseService interface {
    CreateConnection(config ConnectionConfig) (string, error)
    TestConnection(config ConnectionConfig) error
    ListDatabases(connectionID string) ([]Database, error)
    ListTables(connectionID, database string) ([]Table, error)
    GetTableSchema(connectionID, database string, tables []string) (*Schema, error)
    CloseConnection(connectionID string) error
}
```

## API Contract Documentation

### Database Feature API Contracts

#### 1. Session-Based Endpoints (Legacy Support)

##### POST /api/database/connect
**Purpose**: Establish database connection and store in session

**Request Body**:
```go
type ConnectRequest struct {
    Type     string `json:"type" validate:"required,oneof=mysql postgres sqlite"`
    Host     string `json:"host" validate:"required"`
    Port     int    `json:"port" validate:"min=1,max=65535"`
    Username string `json:"username" validate:"required"`
    Password string `json:"password"`
    Database string `json:"database"`
}
```

**Response**:
```go
type ConnectResponse struct {
    Success      bool   `json:"success"`
    Message      string `json:"message,omitempty"`
    ConnectionID string `json:"connectionId,omitempty"`
    DatabaseType string `json:"databaseType,omitempty"`
    Error        string `json:"error,omitempty"`
}
```

**Business Process**:
1. Validate request payload
2. Create database connection using GORM
3. Store connection ID in Redis session
4. Return success response with connection metadata

##### GET /api/database/databases
**Purpose**: List available databases for current session connection

**Response**:
```go
type DatabasesResponse struct {
    Success   bool       `json:"success"`
    Databases []Database `json:"databases,omitempty"`
    Error     string     `json:"error,omitempty"`
}

type Database struct {
    Name string `json:"name"`
    Type string `json:"type"`
}
```

**Business Process**:
1. Retrieve connection ID from session
2. Use GORM to query system databases
3. Return formatted list of databases

##### GET /api/database/tables/:database
**Purpose**: List tables in specified database

**Response**:
```go
type TablesResponse struct {
    Success  bool    `json:"success"`
    Database string  `json:"database,omitempty"`
    Tables   []Table `json:"tables,omitempty"`
    Error    string  `json:"error,omitempty"`
}

type Table struct {
    Name     string `json:"name"`
    Type     string `json:"type"`
    RowCount *int   `json:"rowCount"`
    Size     *int   `json:"size"`
}
```

##### POST /api/database/schema
**Purpose**: Get detailed schema for selected tables

**Request Body**:
```go
type SchemaRequest struct {
    Database string   `json:"database" validate:"required"`
    Tables   []string `json:"tables" validate:"required,min=1"`
}
```

**Response**:
```go
type SchemaResponse struct {
    Success        bool     `json:"success"`
    Database       string   `json:"database,omitempty"`
    SelectedTables []string `json:"selectedTables,omitempty"`
    Schema         *Schema  `json:"schema,omitempty"`
    Error          string   `json:"error,omitempty"`
}

type Schema struct {
    Tables        []TableSchema    `json:"tables"`
    Relationships []Relationship   `json:"relationships"`
}

type TableSchema struct {
    Name    string        `json:"name"`
    Fields  []Field       `json:"fields"`
    Indexes []Index       `json:"indexes"`
    Comment string        `json:"comment"`
}

type Field struct {
    Name          string      `json:"name"`
    Type          string      `json:"type"`
    Size          *int        `json:"size"`
    Primary       bool        `json:"primary"`
    Unique        bool        `json:"unique"`
    NotNull       bool        `json:"notNull"`
    AutoIncrement bool        `json:"autoIncrement"`
    Default       interface{} `json:"default"`
    Comment       string      `json:"comment"`
}

type Relationship struct {
    FromTable   string `json:"fromTable"`
    FromColumn  string `json:"fromColumn"`
    ToTable     string `json:"toTable"`
    ToColumn    string `json:"toColumn"`
    UpdateRule  string `json:"updateRule"`
    DeleteRule  string `json:"deleteRule"`
}
```

#### 2. Stateless Endpoints (React Modal Support)

##### POST /api/database/test-connection
**Purpose**: Test database connection without session storage

**Request Body**: Same as `ConnectRequest`

**Response**:
```go
type TestConnectionResponse struct {
    Success bool              `json:"success"`
    Message string            `json:"message,omitempty"`
    Config  *ConnectionConfig `json:"config,omitempty"`
    Error   string            `json:"error,omitempty"`
}

type ConnectionConfig struct {
    Type     string `json:"type"`
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Database string `json:"database"`
}
```

**Business Process**:
1. Validate connection parameters
2. Create temporary GORM connection
3. Test connection with simple query
4. Immediately close connection
5. Return success/failure status

##### POST /api/database/get-databases
**Purpose**: List databases with connection parameters (stateless)

**Request Body**: Same as `ConnectRequest`

**Response**: Same as `DatabasesResponse`

**Business Process**:
1. Create temporary connection
2. Query available databases
3. Format response
4. Always cleanup connection in defer/finally

##### POST /api/database/get-tables
**Purpose**: List tables with connection parameters (stateless)

**Request Body**:
```go
type GetTablesRequest struct {
    Type             string `json:"type" validate:"required"`
    Host             string `json:"host" validate:"required"`
    Port             int    `json:"port"`
    Username         string `json:"username" validate:"required"`
    Password         string `json:"password"`
    Database         string `json:"database"`
    SelectedDatabase string `json:"selectedDatabase" validate:"required"`
}
```

**Response**: Same as `TablesResponse`

##### POST /api/database/import-schema
**Purpose**: Import database schema directly to diagram format (stateless)

**Request Body**:
```go
type ImportSchemaRequest struct {
    Type             string   `json:"type" validate:"required"`
    Host             string   `json:"host" validate:"required"`
    Port             int      `json:"port"`
    Username         string   `json:"username" validate:"required"`
    Password         string   `json:"password"`
    Database         string   `json:"database"`
    SelectedDatabase string   `json:"selectedDatabase" validate:"required"`
    SelectedTables   []string `json:"selectedTables" validate:"required,min=1"`
}
```

**Response**:
```go
type ImportSchemaResponse struct {
    Success        bool          `json:"success"`
    Database       string        `json:"database,omitempty"`
    SelectedTables []string      `json:"selectedTables,omitempty"`
    DiagramData    *DiagramData  `json:"diagramData,omitempty"`
    Error          string        `json:"error,omitempty"`
}

type DiagramData struct {
    Database      string         `json:"database"`
    Title         string         `json:"title"`
    Tables        []DiagramTable `json:"tables"`
    Relationships []DiagramRel   `json:"relationships"`
    Notes         []interface{}  `json:"notes"`
    SubjectAreas  []interface{}  `json:"subjectAreas"`
    Transform     Transform      `json:"transform"`
}

type DiagramTable struct {
    ID      string         `json:"id"`
    Name    string         `json:"name"`
    Comment string         `json:"comment"`
    Color   string         `json:"color"`
    X       float64        `json:"x"`
    Y       float64        `json:"y"`
    Fields  []DiagramField `json:"fields"`
    Indices []DiagramIndex `json:"indices"`
}

type DiagramField struct {
    ID        string      `json:"id"`
    Name      string      `json:"name"`
    Type      string      `json:"type"`
    Default   string      `json:"default"`
    Check     string      `json:"check"`
    Primary   bool        `json:"primary"`
    Unique    bool        `json:"unique"`
    NotNull   bool        `json:"notNull"`
    Increment bool        `json:"increment"`
    Comment   string      `json:"comment"`
}

type DiagramRel struct {
    ID               int    `json:"id"`
    Name             string `json:"name"`
    StartTableID     string `json:"startTableId"`
    EndTableID       string `json:"endTableId"`
    StartFieldID     string `json:"startFieldId"`
    EndFieldID       string `json:"endFieldId"`
    Cardinality      int    `json:"cardinality"`
    UpdateConstraint int    `json:"updateConstraint"`
    DeleteConstraint int    `json:"deleteConstraint"`
}

type Transform struct {
    Zoom float64 `json:"zoom"`
    Pan  Pan     `json:"pan"`
}

type Pan struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}
```

**Business Process**:
1. Create temporary connection with provided parameters
2. Extract schema for selected tables using GORM reflection
3. Generate DBML using Go DBML library
4. Convert DBML to DrawDB diagram format
5. Return complete diagram data for frontend consumption
6. Always cleanup connection

### Gists Feature API Contracts

#### POST /api/gists
**Purpose**: Create new gist (file sharing)

**Request Body**:
```go
type CreateGistRequest struct {
    Filename    string `json:"filename" validate:"required"`
    Description string `json:"description"`
    Content     string `json:"content" validate:"required"`
    Public      bool   `json:"public"`
}
```

**Response**:
```go
type CreateGistResponse struct {
    Success bool      `json:"success"`
    Data    *GistData `json:"data,omitempty"`
    Error   string    `json:"error,omitempty"`
}

type GistData struct {
    ID string `json:"id"`
}
```

#### GET /api/gists/:id
**Purpose**: Retrieve gist by ID

**Response**:
```go
type GetGistResponse struct {
    ID          string                 `json:"id"`
    Description string                 `json:"description"`
    Public      bool                   `json:"public"`
    CreatedAt   time.Time              `json:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at"`
    Files       map[string]GistFile    `json:"files"`
}

type GistFile struct {
    Filename  string      `json:"filename"`
    Type      string      `json:"type"`
    Language  string      `json:"language"`
    RawURL    string      `json:"raw_url"`
    Size      int         `json:"size"`
    Truncated bool        `json:"truncated"`
    Content   interface{} `json:"content"`
}
```

## GORM Models and Database Design

### Connection Management
```go
// internal/features/database/models/connection.go
type Connection struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    Type      string    `json:"type" gorm:"not null"`
    Host      string    `json:"host" gorm:"not null"`
    Port      int       `json:"port"`
    Username  string    `json:"username" gorm:"not null"`
    Database  string    `json:"database"`
    Config    string    `json:"config" gorm:"type:text"` // JSON config
    CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
    ExpiresAt time.Time `json:"expiresAt" gorm:"index"`
}

func (Connection) TableName() string {
    return "connections"
}
```

### Gist Storage
```go
// internal/features/gists/models/gist.go
type Gist struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    Filename    string    `json:"filename" gorm:"not null"`
    Description string    `json:"description"`
    Content     string    `json:"content" gorm:"type:longtext"`
    Public      bool      `json:"public" gorm:"default:false"`
    CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
    UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (Gist) TableName() string {
    return "gists"
}
```

## Service Layer Implementation

### Database Service
```go
// internal/features/database/services/database_service.go
type Service struct {
    connections sync.Map // Thread-safe connection pool
    config      *config.Config
}

func NewService(cfg *config.Config) *Service {
    return &Service{
        connections: sync.Map{},
        config:      cfg,
    }
}

func (s *Service) CreateConnection(cfg ConnectionConfig) (string, error) {
    connectionID := uuid.New().String()

    var db *gorm.DB
    var err error

    switch cfg.Type {
    case "mysql":
        dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
            cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
        db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})

    case "postgres":
        dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=disable TimeZone=UTC",
            cfg.Host, cfg.Username, cfg.Password, cfg.Database, cfg.Port)
        db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})

    case "sqlite":
        db, err = gorm.Open(sqlite.Open(cfg.Database), &gorm.Config{})

    default:
        return "", fmt.Errorf("unsupported database type: %s", cfg.Type)
    }

    if err != nil {
        return "", err
    }

    // Test connection
    sqlDB, err := db.DB()
    if err != nil {
        return "", err
    }

    if err := sqlDB.Ping(); err != nil {
        return "", err
    }

    // Store connection
    conn := &ConnectionInstance{
        DB:        db,
        Type:      cfg.Type,
        Config:    cfg,
        CreatedAt: time.Now(),
    }

    s.connections.Store(connectionID, conn)

    // Set connection timeout
    go s.scheduleConnectionCleanup(connectionID, 1*time.Hour)

    return connectionID, nil
}

func (s *Service) ListDatabases(connectionID string) ([]Database, error) {
    conn, exists := s.getConnection(connectionID)
    if !exists {
        return nil, fmt.Errorf("connection not found")
    }

    var databases []Database

    switch conn.Type {
    case "mysql":
        err := conn.DB.Raw("SHOW DATABASES").Scan(&databases)
        return databases, err

    case "postgres":
        err := conn.DB.Raw("SELECT datname as name FROM pg_database WHERE datistemplate = false").Scan(&databases)
        return databases, err

    case "sqlite":
        // SQLite doesn't have multiple databases
        return []Database{{Name: "main", Type: "database"}}, nil

    default:
        return nil, fmt.Errorf("unsupported database type")
    }
}
```

### DBML Integration
```go
// pkg/dbml/generator.go
type Generator struct{}

func NewGenerator() *Generator {
    return &Generator{}
}

func (g *Generator) ConvertSchemaToDBML(schema *Schema) (string, error) {
    var dbml strings.Builder

    // Project header
    dbml.WriteString("Project DrawDB_Import {\n")
    dbml.WriteString("  database_type: 'Multi-Database'\n")
    dbml.WriteString(fmt.Sprintf("  Note: 'Generated at %s'\n", time.Now().Format(time.RFC3339)))
    dbml.WriteString("}\n\n")

    // Generate tables
    for _, table := range schema.Tables {
        dbml.WriteString(fmt.Sprintf("Table %s {\n", g.escapeIdentifier(table.Name)))

        for _, field := range table.Fields {
            dbml.WriteString(fmt.Sprintf("  %s %s", g.escapeIdentifier(field.Name), field.Type))

            // Add constraints
            constraints := g.buildFieldConstraints(field)
            if len(constraints) > 0 {
                dbml.WriteString(fmt.Sprintf(" [%s]", strings.Join(constraints, ", ")))
            }

            dbml.WriteString("\n")
        }

        dbml.WriteString("}\n\n")
    }

    // Generate relationships
    for _, rel := range schema.Relationships {
        cardinality := g.determineCardinality(rel)
        dbml.WriteString(fmt.Sprintf("Ref: %s.%s %s %s.%s",
            g.escapeIdentifier(rel.FromTable),
            g.escapeIdentifier(rel.FromColumn),
            cardinality,
            g.escapeIdentifier(rel.ToTable),
            g.escapeIdentifier(rel.ToColumn)))

        if rel.UpdateRule != "" || rel.DeleteRule != "" {
            actions := []string{}
            if rel.UpdateRule != "" && rel.UpdateRule != "RESTRICT" {
                actions = append(actions, fmt.Sprintf("update: %s", strings.ToLower(rel.UpdateRule)))
            }
            if rel.DeleteRule != "" && rel.DeleteRule != "RESTRICT" {
                actions = append(actions, fmt.Sprintf("delete: %s", strings.ToLower(rel.DeleteRule)))
            }

            if len(actions) > 0 {
                dbml.WriteString(fmt.Sprintf(" [%s]", strings.Join(actions, ", ")))
            }
        }

        dbml.WriteString("\n")
    }

    return dbml.String(), nil
}
```

## Middleware Implementation

### CORS Middleware
```go
// internal/middleware/cors.go
func CORSMiddleware(config *config.Config) fiber.Handler {
    return cors.New(cors.Config{
        AllowOrigins: config.CORS.AllowedOrigins,
        AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH",
        AllowHeaders: "Origin,Content-Type,Accept,Authorization,X-Requested-With",
        AllowCredentials: true,
    })
}
```

### Session Middleware
```go
// internal/middleware/session.go
func SessionMiddleware(store *redis.Store) fiber.Handler {
    return session.New(session.Config{
        Storage: store,
        KeyLookup: "cookie:sessionid",
        CookieDomain: "",
        CookiePath: "/",
        CookieSecure: false,
        CookieHTTPOnly: true,
        CookieSameSite: "Lax",
        Expiration: 24 * time.Hour,
    })
}
```

### Error Handling Middleware
```go
// internal/middleware/error_handler.go
func ErrorHandler() fiber.Handler {
    return func(c *fiber.Ctx) error {
        err := c.Next()
        if err != nil {
            code := fiber.StatusInternalServerError
            message := "Internal Server Error"

            if e, ok := err.(*fiber.Error); ok {
                code = e.Code
                message = e.Message
            }

            return c.Status(code).JSON(fiber.Map{
                "success": false,
                "error":   message,
            })
        }
        return nil
    }
}
```

## Configuration Management

```go
// internal/config/config.go
type Config struct {
    Server   ServerConfig   `mapstructure:"server"`
    Database DatabaseConfig `mapstructure:"database"`
    Session  SessionConfig  `mapstructure:"session"`
    CORS     CORSConfig     `mapstructure:"cors"`
}

type ServerConfig struct {
    Port         int    `mapstructure:"port" default:"3001"`
    Host         string `mapstructure:"host" default:"localhost"`
    ReadTimeout  int    `mapstructure:"read_timeout" default:"10"`
    WriteTimeout int    `mapstructure:"write_timeout" default:"10"`
}

type SessionConfig struct {
    RedisURL   string        `mapstructure:"redis_url" default:"redis://localhost:6379/0"`
    Secret     string        `mapstructure:"secret" default:"drawdb-secret-key"`
    Expiration time.Duration `mapstructure:"expiration" default:"24h"`
}

func Load() (*Config, error) {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(".")
    viper.AddConfigPath("./config")

    viper.AutomaticEnv()
    viper.SetEnvPrefix("DRAWDB")

    var config Config
    if err := viper.ReadInConfig(); err != nil {
        // Config file not found, use defaults
        log.Println("Config file not found, using defaults")
    }

    if err := viper.Unmarshal(&config); err != nil {
        return nil, fmt.Errorf("unable to decode config: %w", err)
    }

    return &config, nil
}
```

## Testing Strategy

### Unit Tests
```go
// internal/features/database/services/database_service_test.go
func TestDatabaseService_CreateConnection(t *testing.T) {
    service := NewService(&config.Config{})

    tests := []struct {
        name    string
        config  ConnectionConfig
        wantErr bool
    }{
        {
            name: "valid mysql connection",
            config: ConnectionConfig{
                Type:     "mysql",
                Host:     "localhost",
                Port:     3306,
                Username: "root",
                Password: "password",
                Database: "test",
            },
            wantErr: false,
        },
        {
            name: "invalid database type",
            config: ConnectionConfig{
                Type:     "invalid",
                Host:     "localhost",
                Username: "root",
            },
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            connectionID, err := service.CreateConnection(tt.config)

            if tt.wantErr {
                assert.Error(t, err)
                assert.Empty(t, connectionID)
            } else {
                assert.NoError(t, err)
                assert.NotEmpty(t, connectionID)

                // Cleanup
                service.CloseConnection(connectionID)
            }
        })
    }
}
```

### Integration Tests
```go
// tests/integration/database_test.go
func TestDatabaseEndpoints(t *testing.T) {
    app := setupTestApp()

    // Test connection endpoint
    req := httptest.NewRequest("POST", "/api/database/test-connection", strings.NewReader(`{
        "type": "sqlite",
        "host": "",
        "port": 0,
        "username": "test",
        "password": "",
        "database": ":memory:"
    }`))
    req.Header.Set("Content-Type", "application/json")

    resp, err := app.Test(req)
    assert.NoError(t, err)
    assert.Equal(t, 200, resp.StatusCode)

    var response TestConnectionResponse
    err = json.NewDecoder(resp.Body).Decode(&response)
    assert.NoError(t, err)
    assert.True(t, response.Success)
}
```

## Deployment Configuration

### Docker Support
```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main cmd/api/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/config ./config
EXPOSE 3001
CMD ["./main"]
```

### Environment Configuration
```yaml
# config/config.yaml
server:
  port: 3001
  host: "0.0.0.0"
  read_timeout: 30
  write_timeout: 30

session:
  redis_url: "${REDIS_URL:redis://localhost:6379/0}"
  secret: "${SESSION_SECRET:drawdb-secret-key}"
  expiration: "24h"

cors:
  allowed_origins: "${CORS_ORIGINS:http://localhost:5173,http://localhost:3000}"

database:
  cleanup_interval: "1h"
  max_connections: 100
```

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1-2)
1. Setup Go Fiber application with feature-based structure
2. Implement GORM connection management
3. Create middleware layer (CORS, sessions, error handling)
4. Implement configuration management
5. Setup Redis for session storage

### Phase 2: Database Feature Migration (Week 3)
1. Implement all database endpoints with identical contracts
2. Add GORM-based database introspection
3. Implement DBML generation (evaluate Go library vs Node.js service)
4. Add comprehensive error handling and validation
5. Unit and integration testing

### Phase 3: Gists Feature and Production Readiness (Week 4)
1. Implement gists service with file-based storage
2. Add performance monitoring and logging
3. Complete API compatibility testing
4. Production deployment configuration
5. Performance benchmarking against Node.js version

## API Compatibility Checklist

- [ ] All endpoint URLs match exactly (`/api/database/*`, `/api/gists/*`)
- [ ] Request/response JSON structures are identical
- [ ] HTTP status codes match for all scenarios
- [ ] Error message formats are consistent
- [ ] Session handling behavior is identical
- [ ] CORS configuration matches
- [ ] File storage paths and naming conventions match
- [ ] Database connection timeout behaviors are consistent
- [ ] DBML generation output is identical

## Performance Monitoring

### Metrics to Track
1. **Response Times**: API endpoint latency
2. **Memory Usage**: Connection pool and session storage
3. **Database Connections**: Active connections and cleanup
4. **Error Rates**: Failed requests and database errors
5. **Throughput**: Requests per second

### Monitoring Setup
```go
// internal/middleware/metrics.go
func MetricsMiddleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        start := time.Now()

        err := c.Next()

        duration := time.Since(start)

        // Log metrics
        log.Printf("API call: %s %s - %dms - %d",
            c.Method(),
            c.Path(),
            duration.Milliseconds(),
            c.Response().StatusCode(),
        )

        return err
    }
}
```

This architecture ensures 100% API compatibility between Node.js and Go implementations while providing better performance, type safety, and maintainability through Go's feature-based architecture pattern.