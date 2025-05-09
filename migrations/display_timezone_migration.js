// Script to display the SQL migration for adding timezone to app_settings
const fs = require('fs');
const path = require('path');

function displayMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'add_timezone_to_app_settings.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Migration SQL for adding timezone to app_settings:');
    console.log('----------------------------------');
    console.log(migrationSql);
    console.log('----------------------------------');
    
    console.log('\nTo apply this migration, please:');
    console.log('1. Log in to your Supabase dashboard');
    console.log('2. Go to the SQL Editor');
    console.log('3. Create a new query');
    console.log('4. Copy and paste the SQL above');
    console.log('5. Run the query');
    
  } catch (error) {
    console.error('Error reading migration file:', error);
    process.exit(1);
  }
}

displayMigration();
