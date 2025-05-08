-- First, let's check the current manager's department
SELECT ur.user_id, p.full_name, ur.role, ur.department_id, d.name as department_name
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
LEFT JOIN departments d ON ur.department_id = d.id
WHERE ur.role = 'manager';

-- Now, let's check which employees are not in the manager's department
SELECT ur.user_id, p.full_name, ur.role, ur.department_id, d.name as department_name
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
LEFT JOIN departments d ON ur.department_id = d.id
WHERE ur.role = 'employee';

-- Get the manager's department ID (assuming there's only one manager)
SELECT department_id FROM user_roles WHERE role = 'manager' LIMIT 1;

-- Assign all employees to the manager's department
-- Replace 'manager-department-id' with the actual department ID from the previous query
UPDATE user_roles 
SET department_id = '08e40049-a82b-41ad-ab30-2a0bd1e444e8'  -- Replace with your manager's department ID
WHERE role = 'employee';

-- Also update the profiles table to match
UPDATE profiles 
SET department_id = '08e40049-a82b-41ad-ab30-2a0bd1e444e8'  -- Replace with your manager's department ID
WHERE role = 'employee';

-- Verify the changes
SELECT ur.user_id, p.full_name, ur.role, ur.department_id, d.name as department_name
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
LEFT JOIN departments d ON ur.department_id = d.id
ORDER BY ur.role, p.full_name;
