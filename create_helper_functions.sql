-- Create helper functions for the fix_user_roles.js script

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION check_table_exists(table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = check_table_exists.table_name
  ) INTO table_exists;
  
  RETURN table_exists;
END;
$$;

-- Function to create the check_table_exists function
CREATE OR REPLACE FUNCTION create_check_table_exists_function()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE FUNCTION check_table_exists(table_name TEXT)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
      table_exists BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = check_table_exists.table_name
      ) INTO table_exists;
      
      RETURN table_exists;
    END;
    $func$;
  ';
END;
$$;

-- Function to execute SQL
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Function to create the exec_sql function
CREATE OR REPLACE FUNCTION create_exec_sql_function()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    BEGIN
      EXECUTE sql;
    END;
    $func$;
  ';
END;
$$;
