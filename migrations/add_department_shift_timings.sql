-- Add shift timing fields to departments table
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS shift_start_time TIME,
ADD COLUMN IF NOT EXISTS shift_end_time TIME,
ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 30;

-- Add comments to explain the fields
COMMENT ON COLUMN departments.shift_start_time IS 'The scheduled start time for shifts in this department';
COMMENT ON COLUMN departments.shift_end_time IS 'The scheduled end time for shifts in this department';
COMMENT ON COLUMN departments.grace_period_minutes IS 'Grace period in minutes before an employee is marked late (default: 30)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_departments_shift_times ON departments(shift_start_time, shift_end_time);

-- Update existing departments with default shift times (9 AM to 5 PM)
UPDATE departments
SET shift_start_time = '09:00:00',
    shift_end_time = '17:00:00',
    grace_period_minutes = 30
WHERE shift_start_time IS NULL OR shift_end_time IS NULL;
