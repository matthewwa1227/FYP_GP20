-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  subject VARCHAR(100) DEFAULT 'General',
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  due_date TIMESTAMP,
  estimated_minutes INTEGER DEFAULT 30,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks';

ALTER TABLE tasks ADD COLUMN priority_temp varchar(20);

ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;

ALTER TABLE tasks 
ALTER COLUMN priority TYPE varchar(20) 
USING CASE 
  WHEN priority = 1 THEN 'high'
  WHEN priority = 2 THEN 'medium'
  WHEN priority = 3 THEN 'low'
  ELSE 'medium'
END;

