-- Function to calculate adherence status
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
  v_grace_end_time TIME;
BEGIN
  -- Get user's department and shift information
  SELECT department_id INTO v_department_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- If no department, use default times
  IF v_department_id IS NULL THEN
    v_shift_start_time := '09:00:00'::TIME;
    v_grace_period_minutes := 30;
  ELSE
    -- Get department shift times
    SELECT shift_start_time, grace_period_minutes INTO v_shift_start_time, v_grace_period_minutes
    FROM departments
    WHERE id = v_department_id;
    
    -- If shift times not set, use defaults
    IF v_shift_start_time IS NULL THEN
      v_shift_start_time := '09:00:00'::TIME;
    END IF;
    
    IF v_grace_period_minutes IS NULL THEN
      v_grace_period_minutes := 30;
    END IF;
  END IF;
  
  -- Calculate grace period end time
  v_grace_end_time := v_shift_start_time + (v_grace_period_minutes || ' minutes')::INTERVAL;
  
  -- Get first signin of the day
  SELECT MIN(timestamp) INTO v_first_signin
  FROM attendance_logs
  WHERE user_id = p_user_id
    AND event_type = 'signin'
    AND timestamp::DATE = p_date;
  
  -- If no signin, check if marked absent
  IF v_first_signin IS NULL THEN
    -- Check if already marked absent
    SELECT status INTO v_status
    FROM attendance_adherence
    WHERE user_id = p_user_id
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
  
  -- Extract time from timestamp
  v_signin_time := v_first_signin::TIME;
  
  -- Determine adherence status
  IF v_signin_time < v_shift_start_time THEN
    RETURN 'early';
  ELSIF v_signin_time <= v_grace_end_time THEN
    RETURN 'on_time';
  ELSE
    RETURN 'late';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if an employee is eligible to be marked absent
CREATE OR REPLACE FUNCTION check_absent_eligibility(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_department_id UUID;
  v_shift_start_time TIME;
  v_first_signin TIMESTAMP WITH TIME ZONE;
  v_current_status adherence_status;
BEGIN
  -- Get current adherence status
  SELECT status INTO v_current_status
  FROM attendance_adherence
  WHERE user_id = p_user_id
    AND date = p_date;
    
  -- If already marked absent, not eligible
  IF v_current_status = 'absent' THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's department
  SELECT department_id INTO v_department_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Get shift start time
  IF v_department_id IS NULL THEN
    v_shift_start_time := '09:00:00'::TIME;
  ELSE
    SELECT COALESCE(shift_start_time, '09:00:00'::TIME) INTO v_shift_start_time
    FROM departments
    WHERE id = v_department_id;
  END IF;
  
  -- Get first signin of the day
  SELECT MIN(timestamp) INTO v_first_signin
  FROM attendance_logs
  WHERE user_id = p_user_id
    AND event_type = 'signin'
    AND timestamp::DATE = p_date;
  
  -- If no signin and current time is more than 4 hours past shift start, eligible for absent
  IF v_first_signin IS NULL AND 
     p_date = CURRENT_DATE AND
     CURRENT_TIME > (v_shift_start_time + INTERVAL '4 hours') THEN
    RETURN TRUE;
  END IF;
  
  -- Not eligible
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update adherence status when attendance logs change
CREATE OR REPLACE FUNCTION update_adherence_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status adherence_status;
  v_date DATE;
BEGIN
  -- Get the date from the timestamp
  v_date := NEW.timestamp::DATE;
  
  -- Calculate adherence status
  v_status := calculate_adherence_status(NEW.user_id, v_date);
  
  -- Skip if no status determined
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update adherence record
  INSERT INTO attendance_adherence (user_id, date, status)
  VALUES (NEW.user_id, v_date, v_status)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    status = v_status,
    updated_at = NOW()
  WHERE attendance_adherence.status != 'absent'; -- Don't automatically change from absent
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on attendance_logs
DROP TRIGGER IF EXISTS trg_update_adherence_status ON attendance_logs;
CREATE TRIGGER trg_update_adherence_status
AFTER INSERT OR UPDATE ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION update_adherence_status();
