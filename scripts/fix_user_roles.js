// Script to fix user_roles table issues
// Run with: node scripts/fix_user_roles.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUserRoles() {
  try {
    console.log('Starting user_roles fix script...');

    // Check if user_roles table exists
    const { data: tableExists, error: tableCheckError } = await supabase.rpc(
      'check_table_exists',
      { table_name: 'user_roles' }
    );

    if (tableCheckError) {
      console.error('Error checking if user_roles table exists:', tableCheckError);
      
      // Create a custom function to check if table exists
      console.log('Creating custom function to check if table exists...');
      await supabase.rpc('create_check_table_exists_function');
      
      // Check again
      const { data: tableExistsRetry, error: tableCheckErrorRetry } = await supabase.rpc(
        'check_table_exists',
        { table_name: 'user_roles' }
      );
      
      if (tableCheckErrorRetry) {
        console.error('Error checking if user_roles table exists (retry):', tableCheckErrorRetry);
        console.log('Will attempt to create the table anyway...');
      } else {
        console.log(`user_roles table exists: ${tableExistsRetry}`);
      }
    } else {
      console.log(`user_roles table exists: ${tableExists}`);
    }

    // Create user_roles table if it doesn't exist
    console.log('Creating user_roles table if it doesn\'t exist...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID PRIMARY KEY REFERENCES profiles(id),
        role TEXT NOT NULL,
        department_id UUID REFERENCES departments(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_roles_department_id ON user_roles(department_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
    `;
    
    const { error: createTableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (createTableError) {
      console.error('Error creating user_roles table:', createTableError);
      
      // Create a custom function to execute SQL
      console.log('Creating custom function to execute SQL...');
      await supabase.rpc('create_exec_sql_function');
      
      // Try again
      const { error: createTableErrorRetry } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (createTableErrorRetry) {
        console.error('Error creating user_roles table (retry):', createTableErrorRetry);
      } else {
        console.log('user_roles table created successfully');
      }
    } else {
      console.log('user_roles table created or already exists');
    }

    // Enable RLS on user_roles
    console.log('Enabling RLS on user_roles...');
    const enableRLSSQL = `
      ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
      
      -- Create RLS policies for user_roles if they don't exist
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_roles' AND policyname = 'admin_all_user_roles'
        ) THEN
          CREATE POLICY admin_all_user_roles ON user_roles
            FOR ALL
            TO authenticated
            USING (
              EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
              )
            );
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_roles' AND policyname = 'manager_read_department_user_roles'
        ) THEN
          CREATE POLICY manager_read_department_user_roles ON user_roles
            FOR SELECT
            TO authenticated
            USING (
              EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'manager'
                AND profiles.department_id = user_roles.department_id
              )
            );
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_roles' AND policyname = 'read_own_user_role'
        ) THEN
          CREATE POLICY read_own_user_role ON user_roles
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
        END IF;
      END
      $$;
    `;
    
    const { error: enableRLSError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });
    
    if (enableRLSError) {
      console.error('Error enabling RLS on user_roles:', enableRLSError);
    } else {
      console.log('RLS enabled on user_roles');
    }

    // Get all profiles
    console.log('Fetching all profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }
    
    console.log(`Found ${profiles.length} profiles`);

    // Get existing user_roles
    console.log('Fetching existing user_roles...');
    const { data: existingUserRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, department_id');
    
    if (userRolesError) {
      console.error('Error fetching user_roles:', userRolesError);
      return;
    }
    
    console.log(`Found ${existingUserRoles?.length || 0} existing user_roles`);

    // Create a map of existing user_roles
    const userRolesMap = new Map();
    existingUserRoles?.forEach(ur => {
      userRolesMap.set(ur.user_id, ur);
    });

    // Process each profile
    let insertCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    
    for (const profile of profiles) {
      if (userRolesMap.has(profile.id)) {
        // Check if update is needed
        const existingUserRole = userRolesMap.get(profile.id);
        if (existingUserRole.role !== profile.role || 
            existingUserRole.department_id !== profile.department_id) {
          // Update user_role
          const { error: updateError } = await supabase
            .from('user_roles')
            .update({
              role: profile.role,
              department_id: profile.department_id,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', profile.id);
          
          if (updateError) {
            console.error(`Error updating user_role for ${profile.full_name || profile.id}:`, updateError);
          } else {
            console.log(`Updated user_role for ${profile.full_name || profile.id}`);
            updateCount++;
          }
        } else {
          skipCount++;
        }
      } else {
        // Insert new user_role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: profile.id,
            role: profile.role,
            department_id: profile.department_id
          });
        
        if (insertError) {
          console.error(`Error inserting user_role for ${profile.full_name || profile.id}:`, insertError);
        } else {
          console.log(`Inserted user_role for ${profile.full_name || profile.id}`);
          insertCount++;
        }
      }
    }

    console.log(`Fix complete: ${insertCount} inserted, ${updateCount} updated, ${skipCount} skipped`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixUserRoles().catch(console.error);
