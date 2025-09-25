import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * Download Laravel migrations as a ZIP file
 * @param {Array} migrations - Array of migration objects from toLaravel
 * @param {string} projectName - Name for the ZIP file
 */
export async function downloadLaravelMigrations(migrations, projectName = "laravel_migrations") {
  const zip = new JSZip();

  // Add each migration file to the ZIP
  migrations.forEach(migration => {
    zip.file(migration.filename, migration.content);
  });

  // Add a README with instructions
  const readme = generateMigrationReadme(migrations);
  zip.file("README.md", readme);

  // Generate and download the ZIP file
  try {
    const content = await zip.generateAsync({ type: "blob" });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `${projectName}_${timestamp}.zip`;

    saveAs(content, filename);
    return { success: true, filename };
  } catch (error) {
    console.error('Error generating Laravel migrations ZIP:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a README file with migration instructions
 * @param {Array} migrations - Array of migration objects
 * @returns {string} README content
 */
function generateMigrationReadme(migrations) {
  const tableMigrations = migrations.filter(m => m.type === 'table');
  const relationshipMigrations = migrations.filter(m => m.type === 'foreign_keys');

  return `# Laravel Migrations

Generated from DrawDB on ${new Date().toISOString()}

## Summary
- **Total Migrations**: ${migrations.length}
- **Table Migrations**: ${tableMigrations.length}
- **Relationship Migrations**: ${relationshipMigrations.length}

## Installation Instructions

1. Copy all migration files to your Laravel project's \`database/migrations/\` directory
2. Run migrations in your Laravel project:
   \`\`\`bash
   php artisan migrate
   \`\`\`

## Migration Files

### Table Creation Migrations
${tableMigrations.map(m => `- ${m.filename} (${m.table})`).join('\n')}

### Foreign Key Migrations
${relationshipMigrations.map(m => `- ${m.filename} (${m.table})`).join('\n')}

## Migration Order

The migrations are timestamped to ensure proper execution order:
1. All table creation migrations run first
2. Foreign key constraint migrations run after tables are created

## Laravel Version Compatibility

These migrations are compatible with Laravel 12.x and use:
- Anonymous class syntax (Laravel 9+)
- Blueprint schema builder methods
- Standard Laravel migration patterns

## Database Configuration

Make sure your Laravel \`.env\` file is configured with the correct database settings:

\`\`\`
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_username
DB_PASSWORD=your_password
\`\`\`

## Additional Commands

\`\`\`bash
# Check migration status
php artisan migrate:status

# Rollback migrations (be careful in production!)
php artisan migrate:rollback

# Fresh migration (drops all tables and re-runs migrations)
php artisan migrate:fresh
\`\`\`

## Generated with DrawDB

Database schema editor and Laravel migration generator
https://drawdb.vercel.app

For more information about Laravel migrations, visit:
https://laravel.com/docs/12.x/migrations
`;
}