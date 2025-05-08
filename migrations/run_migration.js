// Simple script to run the SQL migration using the Supabase JS client
// Usage: node run_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key (required for schema changes)
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'add_break_event_types.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: add_break_event_types.sql');
    
    // Execute the SQL
    const { error } = await supabase.rpc('pgtle_install_extension_if_not_exists', {
      name: 'pg_tle',
      version: '1.0.0',
      schema: 'pgtle',
      requires: '{}',
      description: 'Trusted Language Extensions for PostgreSQL',
      relocatable: false,
      superuser: true,
      trusted: false,
      loadable_libraries: '{}',
      install_commands: [migrationSql],
      install_error: ''
    });

    if (error) {
      console.error('Error running migration:', error);
      process.exit(1);
    }

    console.log('Migration completed successfully!');
    console.log('Next steps:');
    console.log('1. Regenerate TypeScript types: npx supabase gen types typescript --project-id your-project-id --schema public > lib/supabase/database.types.ts');
    console.log('2. Restart your development server');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runMigration();
