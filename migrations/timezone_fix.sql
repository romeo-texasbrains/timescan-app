-- Create a settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert or update the timezone setting with a default value
INSERT INTO settings (key, value)
VALUES ('timezone', 'Asia/Karachi')
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Create a function to get the current timezone setting
CREATE OR REPLACE FUNCTION get_app_timezone()
RETURNS TEXT AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT value INTO v_timezone FROM settings WHERE key = 'timezone' LIMIT 1;
  RETURN COALESCE(v_timezone, 'Asia/Karachi');
END;
$$ LANGUAGE plpgsql;

-- Create a function to update the timezone setting
CREATE OR REPLACE FUNCTION update_timezone_setting(p_timezone TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO settings (key, value)
  VALUES ('timezone', p_timezone)
  ON CONFLICT (key)
  DO UPDATE SET value = p_timezone, updated_at = NOW()
  WHERE settings.key = 'timezone';
END;
$$ LANGUAGE plpgsql;

-- Update the calculate_adherence_status function to use the get_app_timezone() function
CREATE OR REPLACE FUNCTION calculate_adherence_status(
  p_user_id UUID,
  p_date DATE
)
RETURNS adherence_status AS $$
DECLARE
  v_department_id UUID;
  v_shift_start_time TIME;
  v_grace_period_minutes INTEGER;
  v_first_signin TIMESTAMP WITH TIME ZONE;
  v_signin_time TIME;
  v_status adherence_status;
  v_early_threshold INTERVAL := '15 minutes';
  v_is_active BOOLEAN;
  v_app_timezone TEXT;
BEGIN
  -- Get the application timezone
  v_app_timezone := get_app_timezone();
  
  -- Get user's department and shift information
  SELECT department_id INTO v_department_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Get shift start time and grace period
  IF v_department_id IS NULL THEN
    v_shift_start_time := '19:00:00'::TIME;
    v_grace_period_minutes := 30;
  ELSE
    SELECT 
      COALESCE(departments.shift_start_time, '19:00:00'::TIME),
      COALESCE(departments.grace_period_minutes, 30)
    INTO v_shift_start_time, v_grace_period_minutes
    FROM departments
    WHERE departments.id = v_department_id;
  END IF;
  
  -- Get first signin of the day
  SELECT MIN(timestamp) INTO v_first_signin
  FROM attendance_logs
  WHERE attendance_logs.user_id = p_user_id
    AND event_type = 'signin'
    AND timestamp::DATE = p_date;
  
  -- Check if user is active today (has signed in)
  v_is_active := v_first_signin IS NOT NULL;
  
  -- If no signin, check if marked absent
  IF NOT v_is_active THEN
    -- Check if already marked absent
    SELECT status INTO v_status
    FROM attendance_adherence
    WHERE attendance_adherence.user_id = p_user_id
      AND date = p_date
      AND status = 'absent';
      
    -- If marked absent, return absent
    IF v_status = 'absent' THEN
      RETURN 'absent';
    END IF;
    
    -- If current time is past shift start + 4 hours, eligible for absent
    IF CURRENT_TIME > (v_shift_start_time + INTERVAL '4 hours') AND CURRENT_DATE = p_date THEN
      RETURN 'late'; -- Late, eligible for absent marking
    ELSE
      -- If date is in the past and no signin, consider absent
      IF p_date < CURRENT_DATE THEN
        RETURN 'absent';
      -- Otherwise, no status yet
      ELSE
        RETURN NULL;
      END IF;
    END IF;
  END IF;
  
  -- Convert UTC timestamp to local timezone and extract time
  v_first_signin := v_first_signin AT TIME ZONE v_app_timezone;
  v_signin_time := v_first_signin::TIME;
  
  -- Determine adherence status based on new rules
  IF v_signin_time < (v_shift_start_time - v_early_threshold) THEN
    -- More than 15 minutes early
    RETURN 'early';
  ELSIF v_signin_time <= v_shift_start_time THEN
    -- Within 15 minutes before shift start
    RETURN 'on_time';
  ELSIF v_signin_time <= (v_shift_start_time + (v_grace_period_minutes || ' minutes')::INTERVAL) THEN
    -- Within grace period after shift start
    RETURN 'on_time';
  ELSE
    -- After grace period
    RETURN 'late';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to fix adherence status for today
CREATE OR REPLACE FUNCTION fix_adherence_status()
RETURNS VOID AS $$
DECLARE
  v_early_threshold INTERVAL := '15 minutes';
  v_record RECORD;
  v_shift_start_time TIME;
  v_grace_period_minutes INTEGER;
  v_department_id UUID;
  v_first_signin TIMESTAMP WITH TIME ZONE;
  v_signin_time TIME;
  v_correct_status adherence_status;
  v_app_timezone TEXT;
BEGIN
  -- Get the application timezone
  v_app_timezone := get_app_timezone();
  
  -- Loop through all active users for today
  FOR v_record IN 
    SELECT 
      p.id as profile_id, 
      p.department_id,
      (SELECT MIN(timestamp) FROM attendance_logs 
       WHERE attendance_logs.user_id = p.id AND event_type = 'signin' 
       AND timestamp::DATE = CURRENT_DATE) as first_signin
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM attendance_logs 
      WHERE attendance_logs.user_id = p.id 
      AND event_type = 'signin' 
      AND timestamp::DATE = CURRENT_DATE
    )
  LOOP
    -- Get shift start time and grace period
    IF v_record.department_id IS NULL THEN
      v_shift_start_time := '19:00:00'::TIME; -- Default 7:00 PM
      v_grace_period_minutes := 30;
    ELSE
      SELECT 
        COALESCE(departments.shift_start_time, '19:00:00'::TIME),
        COALESCE(departments.grace_period_minutes, 30)
      INTO v_shift_start_time, v_grace_period_minutes
      FROM departments
      WHERE departments.id = v_record.department_id;
    END IF;
    
    -- Convert UTC timestamp to local timezone and extract time
    v_first_signin := v_record.first_signin AT TIME ZONE v_app_timezone;
    v_signin_time := v_first_signin::TIME;
    
    -- Determine correct adherence status based on new rules
    IF v_signin_time < (v_shift_start_time - v_early_threshold) THEN
      -- More than 15 minutes early
      v_correct_status := 'early';
    ELSIF v_signin_time <= v_shift_start_time THEN
      -- Within 15 minutes before shift start
      v_correct_status := 'on_time';
    ELSIF v_signin_time <= (v_shift_start_time + (v_grace_period_minutes || ' minutes')::INTERVAL) THEN
      -- Within grace period after shift start
      v_correct_status := 'on_time';
    ELSE
      -- After grace period
      v_correct_status := 'late';
    END IF;
    
    -- Update the adherence status
    UPDATE attendance_adherence
    SET status = v_correct_status,
        updated_at = NOW()
    WHERE attendance_adherence.user_id = v_record.profile_id
    AND date = CURRENT_DATE;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the fix function to update existing records
SELECT fix_adherence_status();
