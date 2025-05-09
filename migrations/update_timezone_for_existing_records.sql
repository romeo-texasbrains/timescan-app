-- This script updates the timezone setting in the app_settings table
-- It will set the timezone to Asia/Karachi for the default app settings record

-- First, check if the app_settings table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'app_settings'
    ) THEN
        -- Create the app_settings table if it doesn't exist
        CREATE TABLE app_settings (
            id INTEGER PRIMARY KEY,
            company_name TEXT,
            default_hours NUMERIC,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            timezone TEXT DEFAULT 'UTC'
        );
        
        -- Insert the default record
        INSERT INTO app_settings (id, company_name, default_hours, timezone)
        VALUES (1, 'TimeScan', 8, 'Asia/Karachi');
    ELSE
        -- Check if the timezone column exists
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'app_settings'
            AND column_name = 'timezone'
        ) THEN
            -- Add the timezone column if it doesn't exist
            ALTER TABLE app_settings ADD COLUMN timezone TEXT DEFAULT 'UTC';
        END IF;
        
        -- Update the timezone for the default record
        UPDATE app_settings
        SET timezone = 'Asia/Karachi'
        WHERE id = 1;
        
        -- If no record exists, create one
        INSERT INTO app_settings (id, company_name, default_hours, timezone)
        SELECT 1, 'TimeScan', 8, 'Asia/Karachi'
        WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
    END IF;
END
$$;
