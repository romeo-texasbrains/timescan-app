-- First, let's check the existing RLS policies for the attendance_logs table
SELECT * FROM pg_policies WHERE tablename = 'attendance_logs';

-- Drop existing policies for attendance_logs table
DROP POLICY IF EXISTS "Users can view their own attendance logs" ON "public"."attendance_logs";
DROP POLICY IF EXISTS "Users can insert their own attendance logs" ON "public"."attendance_logs";
DROP POLICY IF EXISTS "Admins can view all attendance logs" ON "public"."attendance_logs";
DROP POLICY IF EXISTS "Managers can view their team's attendance logs" ON "public"."attendance_logs";
DROP POLICY IF EXISTS "Admins can manage all attendance logs" ON "public"."attendance_logs";
DROP POLICY IF EXISTS "Managers can manage their team's attendance logs" ON "public"."attendance_logs";

-- Create new policies for attendance_logs table

-- 1. Users can view their own attendance logs
CREATE POLICY "Users can view their own attendance logs"
ON "public"."attendance_logs"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Users can insert their own attendance logs
CREATE POLICY "Users can insert their own attendance logs"
ON "public"."attendance_logs"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Admins can view all attendance logs
CREATE POLICY "Admins can view all attendance logs"
ON "public"."attendance_logs"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 4. Admins can manage (insert, update, delete) all attendance logs
CREATE POLICY "Admins can manage all attendance logs"
ON "public"."attendance_logs"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 5. Managers can view their team's attendance logs
CREATE POLICY "Managers can view their team's attendance logs"
ON "public"."attendance_logs"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles manager
    WHERE manager.id = auth.uid()
    AND manager.role = 'manager'
    AND EXISTS (
      SELECT 1 FROM profiles employee
      WHERE employee.id = attendance_logs.user_id
      AND employee.department_id = manager.department_id
    )
  )
);

-- 6. Managers can manage (insert, update, delete) their team's attendance logs
CREATE POLICY "Managers can manage their team's attendance logs"
ON "public"."attendance_logs"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles manager
    WHERE manager.id = auth.uid()
    AND manager.role = 'manager'
    AND EXISTS (
      SELECT 1 FROM profiles employee
      WHERE employee.id = attendance_logs.user_id
      AND employee.department_id = manager.department_id
      AND employee.id != manager.id -- Managers can't edit their own logs
    )
  )
);

-- Verify the policies were created
SELECT * FROM pg_policies WHERE tablename = 'attendance_logs';
