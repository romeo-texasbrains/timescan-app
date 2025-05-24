-- Check if app_settings table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_settings'
    ) THEN
        -- Create app_settings table if it doesn't exist
        CREATE TABLE public.app_settings (
            id SERIAL PRIMARY KEY,
            company_name TEXT DEFAULT 'Default Company Name',
            default_hours NUMERIC(5,2) DEFAULT 8.0,
            timezone TEXT DEFAULT 'UTC',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Insert default record
        INSERT INTO public.app_settings (id, company_name, default_hours, timezone)
        VALUES (1, 'Default Company Name', 8.0, 'UTC');
    ELSE
        -- Add missing columns if table exists but columns don't
        BEGIN
            IF NOT EXISTS (SELECT FROM information_schema.columns 
                          WHERE table_schema = 'public' 
                          AND table_name = 'app_settings' 
                          AND column_name = 'company_name') THEN
                ALTER TABLE public.app_settings ADD COLUMN company_name TEXT DEFAULT 'Default Company Name';
            END IF;
            
            IF NOT EXISTS (SELECT FROM information_schema.columns 
                          WHERE table_schema = 'public' 
                          AND table_name = 'app_settings' 
                          AND column_name = 'default_hours') THEN
                ALTER TABLE public.app_settings ADD COLUMN default_hours NUMERIC(5,2) DEFAULT 8.0;
            END IF;
            
            IF NOT EXISTS (SELECT FROM information_schema.columns 
                          WHERE table_schema = 'public' 
                          AND table_name = 'app_settings' 
                          AND column_name = 'timezone') THEN
                ALTER TABLE public.app_settings ADD COLUMN timezone TEXT DEFAULT 'UTC';
            END IF;
            
            -- Make sure we have at least one record
            IF NOT EXISTS (SELECT FROM public.app_settings WHERE id = 1) THEN
                INSERT INTO public.app_settings (id, company_name, default_hours, timezone)
                VALUES (1, 'Default Company Name', 8.0, 'UTC');
            END IF;
        END;
    END IF;
END
$$;

-- Create or replace the update_timezone_setting function
CREATE OR REPLACE FUNCTION update_timezone_setting(p_timezone TEXT)
RETURNS VOID AS $$
BEGIN
    -- Update the timezone in app_settings
    UPDATE public.app_settings
    SET timezone = p_timezone
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the fix_adherence_status function
-- This is a placeholder - you'll need to implement the actual logic
CREATE OR REPLACE FUNCTION fix_adherence_status()
RETURNS VOID AS $$
BEGIN
    -- Placeholder for any logic needed to fix adherence status
    -- after timezone changes
    -- For now, it's just a placeholder that does nothing
    RAISE NOTICE 'Adherence status fix function called';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
