-- Populate user_roles table with data from profiles
INSERT INTO user_roles (user_id, role, department_id)
SELECT id, role, department_id FROM profiles
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, department_id = EXCLUDED.department_id;

-- Verify the data was inserted correctly
SELECT * FROM user_roles;
