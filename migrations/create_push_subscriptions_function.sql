-- Create a function to create the push_subscriptions table if it doesn't exist
CREATE OR REPLACE FUNCTION create_push_subscriptions_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'push_subscriptions'
  ) THEN
    -- Create the table
    CREATE TABLE push_subscriptions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES profiles(id),
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
    
    -- Enable RLS
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies
    
    -- Users can read their own subscriptions
    CREATE POLICY "Users can read their own push subscriptions" ON push_subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
    
    -- Users can insert their own subscriptions
    CREATE POLICY "Users can insert their own push subscriptions" ON push_subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    
    -- Users can update their own subscriptions
    CREATE POLICY "Users can update their own push subscriptions" ON push_subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
    
    -- Users can delete their own subscriptions
    CREATE POLICY "Users can delete their own push subscriptions" ON push_subscriptions
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
    
    -- Admins can read all subscriptions
    CREATE POLICY "Admins can read all push subscriptions" ON push_subscriptions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END;
$$ LANGUAGE plpgsql;
