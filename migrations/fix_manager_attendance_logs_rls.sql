-- Script to fix RLS policies for attendance_logs table to allow managers to see their team's logs

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

-- Create policy for managers to read attendance_logs for employees in their department
-- This policy allows managers to see attendance logs for all employees in their department
DROP POLICY IF EXISTS manager_read_department_attendance_logs ON attendance_logs;
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

-- List updated policies
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance_logs';

-- Note: This script fixes the issue where managers couldn't see their team's attendance logs
-- in the manager dashboard. The issue was that while managers could see employee profiles
-- in their department, they couldn't see the attendance logs for those employees.
--
-- This script adds a specific RLS policy that allows managers to see attendance logs
-- for employees in their department, which is necessary for the manager dashboard
-- to show real-time attendance status and timesheet data.
