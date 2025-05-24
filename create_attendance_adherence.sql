-- Create enum type for adherence status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adherence_status') THEN
        CREATE TYPE adherence_status AS ENUM ('early', 'on_time', 'late', 'absent');
    END IF;
END$$;

-- Create attendance_adherence table if it doesn't exist
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

-- Manager can view and update attendance_adherence for employees in their department
CREATE POLICY manager_department_attendance_adherence ON attendance_adherence
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles manager
      JOIN profiles employee ON manager.department_id = employee.department_id
      WHERE manager.id = auth.uid()
      AND manager.role = 'manager'
      AND employee.id = attendance_adherence.user_id
    )
  );

-- Users can view their own attendance_adherence
CREATE POLICY user_view_own_attendance_adherence ON attendance_adherence
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert sample data for testing
INSERT INTO attendance_adherence (user_id, date, status)
SELECT 
  p.id, 
  CURRENT_DATE - (i || ' days')::INTERVAL, 
  CASE 
    WHEN i % 4 = 0 THEN 'early'::adherence_status
    WHEN i % 4 = 1 THEN 'on_time'::adherence_status
    WHEN i % 4 = 2 THEN 'late'::adherence_status
    ELSE 'absent'::adherence_status
  END
FROM 
  profiles p,
  generate_series(0, 20) i
WHERE 
  p.role IN ('employee', 'manager')
ON CONFLICT (user_id, date) DO NOTHING;
