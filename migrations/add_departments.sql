-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add department_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Create RLS policies for departments table
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Admin can do everything with departments
CREATE POLICY admin_all_departments ON departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Managers can read departments
CREATE POLICY manager_read_departments ON departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'manager' OR profiles.role = 'admin')
    )
  );

-- Everyone can see their own department
CREATE POLICY users_read_own_department ON departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.department_id = departments.id
    )
  );

-- Create index on department_id in profiles
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id);

-- Insert some default departments
INSERT INTO departments (name, description)
VALUES 
  ('Engineering', 'Software development and engineering team'),
  ('Marketing', 'Marketing and communications team'),
  ('Sales', 'Sales and business development team'),
  ('Human Resources', 'HR and recruitment team'),
  ('Operations', 'Operations and logistics team')
ON CONFLICT DO NOTHING;
