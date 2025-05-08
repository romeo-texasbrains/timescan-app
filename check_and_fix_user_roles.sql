-- Check if user_roles table has any records
SELECT COUNT(*) FROM user_roles;

-- If the count is 0, populate the table from profiles
INSERT INTO user_roles (user_id, role, department_id)
SELECT id, role, department_id FROM profiles
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, department_id = EXCLUDED.department_id;

-- Check if there are any managers in the user_roles table
SELECT * FROM user_roles WHERE role = 'manager';

-- Check if there are any employees in the user_roles table
SELECT * FROM user_roles WHERE role = 'employee';

-- Check if there are any users with null department_id
SELECT * FROM user_roles WHERE department_id IS NULL;

-- Check if there are any departments in the departments table
SELECT * FROM departments;

-- If you need to create a department, uncomment and run this:
-- INSERT INTO departments (name) VALUES ('Main Department');

-- Get the ID of the first department
SELECT id FROM departments LIMIT 1;

-- Update all users with null department_id to use the first department
-- Replace 'department-id-here' with the actual department ID from the previous query
-- UPDATE user_roles SET department_id = 'department-id-here' WHERE department_id IS NULL;

-- Assign all employees to the manager's department
-- Replace 'manager-id-here' with the actual manager's user ID
-- UPDATE user_roles 
-- SET department_id = (SELECT department_id FROM user_roles WHERE user_id = 'manager-id-here')
-- WHERE role = 'employee';

-- Verify the changes
SELECT ur.user_id, p.full_name, ur.role, ur.department_id, d.name as department_name
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
LEFT JOIN departments d ON ur.department_id = d.id
ORDER BY ur.role, p.full_name;
