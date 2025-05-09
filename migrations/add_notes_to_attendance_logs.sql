-- Add notes column to attendance_logs table
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_logs' 
ORDER BY ordinal_position;
