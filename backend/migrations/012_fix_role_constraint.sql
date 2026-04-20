
-- First, drop the existing constraint if it exists
ALTER TABLE students DROP CONSTRAINT IF EXISTS valid_role;

-- Add the role column if it doesn't exist (should already exist)
ALTER TABLE students ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';

-- Add a new constraint that includes 'teacher'
ALTER TABLE students ADD CONSTRAINT valid_role CHECK (role IN ('student', 'parent', 'teacher'));

-- Set default value for any NULL roles
UPDATE students SET role = 'student' WHERE role IS NULL;

-- Make role NOT NULL
ALTER TABLE students ALTER COLUMN role SET NOT NULL;

SELECT 'Role constraint fixed! Now supports: student, parent, teacher' as message;
