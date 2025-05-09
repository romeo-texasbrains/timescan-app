# Debugging Guide

This document provides guidance for debugging common issues in the TimeScan application.

## Table of Contents
1. [Supabase RLS Policy Issues](#supabase-rls-policy-issues)
2. [Real-time Data Not Updating](#real-time-data-not-updating)
3. [Data Access Discrepancies Between User Roles](#data-access-discrepancies-between-user-roles)

## Supabase RLS Policy Issues

Row Level Security (RLS) policies in Supabase control which rows in a table a user can access. Issues with RLS policies can cause data to be inaccessible to certain users or roles.

### Symptoms
- Admin dashboard shows data but manager/employee dashboards don't
- Some users can see data while others with similar roles cannot
- Data appears in one view but not in another for the same user

### Debugging Steps

1. **Check if RLS is enabled on the table**:
   ```sql
   DO $$
   DECLARE
       rls_enabled BOOLEAN;
   BEGIN
       SELECT relrowsecurity INTO rls_enabled
       FROM pg_class
       WHERE relname = 'table_name';
       
       IF rls_enabled IS NULL THEN
           RAISE NOTICE 'Table does not exist';
       ELSIF rls_enabled THEN
           RAISE NOTICE 'RLS is enabled';
       ELSE
           RAISE NOTICE 'RLS is NOT enabled';
       END IF;
   END
   $$;
   ```

2. **List existing policies on a table**:
   ```sql
   SELECT policyname, permissive, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'table_name';
   ```

3. **Test policy effectiveness with specific user IDs**:
   ```sql
   -- Set the role to a specific user
   SET LOCAL ROLE authenticated;
   SET LOCAL request.jwt.claim.sub = 'user_id_here';
   
   -- Try to access data
   SELECT * FROM table_name LIMIT 10;
   ```

### Common RLS Policy Fixes

For tables that need role-based access:

1. **Admin access to all rows**:
   ```sql
   CREATE POLICY admin_all_table_name ON table_name
       FOR ALL
       TO authenticated
       USING (
           EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid()
               AND profiles.role = 'admin'
           )
       );
   ```

2. **Manager access to department data**:
   ```sql
   CREATE POLICY manager_read_department_data ON table_name
       FOR SELECT
       TO authenticated
       USING (
           EXISTS (
               SELECT 1 FROM profiles manager
               JOIN profiles employee ON manager.department_id = employee.department_id
               WHERE manager.id = auth.uid()
               AND manager.role = 'manager'
               AND employee.id = table_name.user_id
           )
       );
   ```

3. **User access to own data**:
   ```sql
   CREATE POLICY read_own_data ON table_name
       FOR SELECT
       TO authenticated
       USING (auth.uid() = user_id);
   ```

## Real-time Data Not Updating

If real-time updates aren't working properly, it could be due to RLS policies, subscription configuration, or client-side issues.

### Debugging Steps

1. **Check RLS policies** as described above

2. **Verify subscription configuration**:
   ```javascript
   // Correct subscription setup
   const subscription = supabase
     .channel('channel-name')
     .on('postgres_changes', {
       event: '*',  // or 'INSERT', 'UPDATE', 'DELETE'
       schema: 'public',
       table: 'table_name',
       // Optional filter
       filter: 'column=eq.value'
     }, callback)
     .subscribe();
   ```

3. **Check browser console** for subscription errors

4. **Test with admin user** to rule out permission issues

## Data Access Discrepancies Between User Roles

When different user roles (admin, manager, employee) see different data for the same entities.

### Debugging Steps

1. **Compare the queries** used for different roles

2. **Check RLS policies** for each table involved

3. **Verify join conditions** in queries that might filter data differently

4. **Test with specific user IDs** using the RLS testing method above

### Example Fix for Attendance Logs Access

If managers can't see their team's attendance logs:

```sql
-- Create policy for managers to read attendance_logs for employees in their department
CREATE POLICY manager_read_department_attendance_logs ON attendance_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles manager
            JOIN profiles employee ON manager.department_id = employee.department_id
            WHERE manager.id = auth.uid()
            AND manager.role = 'manager'
            AND employee.id = attendance_logs.user_id
        )
    );
```

This policy allows managers to see attendance logs for employees in their department.
