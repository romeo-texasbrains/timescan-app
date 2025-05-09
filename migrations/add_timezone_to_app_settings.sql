-- Add timezone column to app_settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'app_settings'
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN timezone TEXT DEFAULT 'UTC';
        
        -- Update existing records to use UTC by default
        UPDATE app_settings SET timezone = 'UTC' WHERE timezone IS NULL;
        
        -- Add comment to document the column
        COMMENT ON COLUMN app_settings.timezone IS 'The timezone used for displaying dates and times throughout the application. Uses IANA timezone names like "America/New_York" or "Asia/Karachi".';
    END IF;
END
$$;
