-- Create enum type for adherence status
CREATE TYPE adherence_status AS ENUM ('early', 'on_time', 'late', 'absent');

-- Create attendance_adherence table
CREATE TABLE IF NOT EXISTS attendance_adherence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  status adherence_status NOT NULL,
  marked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a unique constraint to ensure only one record per user per day
  UNIQUE(user_id, date)
);

-- Add comments to explain the table and fields
COMMENT ON TABLE attendance_adherence IS 'Tracks daily attendance adherence status for employees based on their department shift times';
COMMENT ON COLUMN attendance_adherence.user_id IS 'The employee whose adherence is being tracked';
COMMENT ON COLUMN attendance_adherence.date IS 'The date for which adherence is being tracked';
COMMENT ON COLUMN attendance_adherence.status IS 'The adherence status: early, on_time, late, or absent';
COMMENT ON COLUMN attendance_adherence.marked_by IS 'The admin or manager who marked the status (especially for absent status)';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_adherence_user_date ON attendance_adherence(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_adherence_date ON attendance_adherence(date);
CREATE INDEX IF NOT EXISTS idx_attendance_adherence_status ON attendance_adherence(status);

-- Enable Row Level Security
ALTER TABLE attendance_adherence ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Admin can do everything with attendance_adherence
CREATE POLICY admin_all_attendance_adherence ON attendance_adherence
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Managers can read all adherence records for their department
CREATE POLICY manager_read_attendance_adherence ON attendance_adherence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p1.department_id = p2.department_id
      WHERE p1.id = attendance_adherence.user_id
      AND p2.id = auth.uid()
      AND p2.role = 'manager'
    )
  );

-- Managers can update adherence for their department
CREATE POLICY manager_update_attendance_adherence ON attendance_adherence
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p1.department_id = p2.department_id
      WHERE p1.id = attendance_adherence.user_id
      AND p2.id = auth.uid()
      AND p2.role = 'manager'
    )
  );

-- Managers can insert adherence for their department
CREATE POLICY manager_insert_attendance_adherence ON attendance_adherence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p1.department_id = p2.department_id
      WHERE p1.id = attendance_adherence.user_id
      AND p2.id = auth.uid()
      AND p2.role = 'manager'
    )
  );

-- Users can read their own adherence records
CREATE POLICY users_read_own_attendance_adherence ON attendance_adherence
  FOR SELECT
  TO authenticated
  USING (
    attendance_adherence.user_id = auth.uid()
  );
