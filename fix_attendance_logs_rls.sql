-- Script to check and fix RLS policies for attendance_logs table

-- First, check if RLS is enabled on attendance_logs
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'attendance_logs';
    
    IF rls_enabled IS NULL THEN
        RAISE NOTICE 'Table attendance_logs does not exist';
    ELSIF rls_enabled THEN
        RAISE NOTICE 'RLS is enabled on attendance_logs';
    ELSE
        RAISE NOTICE 'RLS is NOT enabled on attendance_logs';
        -- Enable RLS
        EXECUTE 'ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;';
        RAISE NOTICE 'RLS has been enabled on attendance_logs';
    END IF;
END
$$;

-- List existing policies on attendance_logs
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance_logs';

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS admin_all_attendance_logs ON attendance_logs;
DROP POLICY IF EXISTS manager_read_department_attendance_logs ON attendance_logs;
DROP POLICY IF EXISTS read_own_attendance_logs ON attendance_logs;
DROP POLICY IF EXISTS insert_own_attendance_logs ON attendance_logs;

-- Create policy for admins to do everything with attendance_logs
CREATE POLICY admin_all_attendance_logs ON attendance_logs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create policy for managers to read attendance_logs for employees in their department
CREATE POLICY manager_read_department_attendance_logs ON attendance_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles manager
            JOIN profiles employee ON manager.department_id = employee.department_id
            WHERE manager.id = auth.uid()
            AND manager.role = 'manager'
            AND employee.id = attendance_logs.user_id
        )
    );

-- Create policy for users to read their own attendance_logs
CREATE POLICY read_own_attendance_logs ON attendance_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create policy for users to insert their own attendance_logs
CREATE POLICY insert_own_attendance_logs ON attendance_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- List updated policies
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance_logs';
