-- Check all profiles and their department assignments
SELECT 
  id, 
  full_name, 
  email, 
  role, 
  department_id 
FROM 
  profiles 
ORDER BY 
  full_name;

-- Check the specific department we're interested in
SELECT 
  id, 
  name 
FROM 
  departments 
WHERE 
  id = '08e40049-a82b-41ad-ab30-2a0bd1e444e8';

-- Check all departments
SELECT 
  id, 
  name 
FROM 
  departments 
ORDER BY 
  name;
