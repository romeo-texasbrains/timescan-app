-- This script fixes the issue with the manager dashboard not showing team members
-- It ensures that the manager and all employees in the same department are properly set up in the user_roles table

-- First, check if the user_roles table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'user_roles'
    ) THEN
        -- Create the user_roles table if it doesn't exist
        CREATE TABLE user_roles (
            user_id UUID PRIMARY KEY REFERENCES profiles(id),
            role TEXT NOT NULL,
            department_id UUID REFERENCES departments(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index on department_id
        CREATE INDEX IF NOT EXISTS idx_user_roles_department_id ON user_roles(department_id);
        
        -- Create index on role
        CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
        
        -- Enable RLS on user_roles
        ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for user_roles
        -- Admin can do everything with user_roles
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
        
        -- Managers can read user_roles in their department
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
        
        -- Users can read their own user_role
        CREATE POLICY read_own_user_role ON user_roles
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Populate the user_roles table with data from profiles
INSERT INTO user_roles (user_id, role, department_id)
SELECT id, role, department_id FROM profiles
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, department_id = EXCLUDED.department_id;

-- Check for managers and their departments
SELECT p.id, p.full_name, p.email, p.role, p.department_id, d.name AS department_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.role = 'manager'
ORDER BY p.full_name;

-- Check for employees and their departments
SELECT p.id, p.full_name, p.email, p.role, p.department_id, d.name AS department_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.role = 'employee'
ORDER BY p.full_name;

-- Check for inconsistencies between profiles and user_roles
SELECT p.id, p.full_name, p.email, p.role AS profile_role, ur.role AS user_role, 
       p.department_id AS profile_dept, ur.department_id AS user_role_dept
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE p.role != ur.role OR p.department_id IS DISTINCT FROM ur.department_id;

-- Fix inconsistencies by updating user_roles to match profiles
UPDATE user_roles ur
SET role = p.role, department_id = p.department_id
FROM profiles p
WHERE ur.user_id = p.id
AND (ur.role != p.role OR ur.department_id IS DISTINCT FROM p.department_id);

-- Verify the final state
SELECT ur.user_id, p.full_name, ur.role, ur.department_id, d.name as department_name
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
LEFT JOIN departments d ON ur.department_id = d.id
ORDER BY ur.role, p.full_name;
