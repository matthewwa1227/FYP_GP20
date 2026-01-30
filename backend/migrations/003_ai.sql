-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  conversation_type VARCHAR(20) DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'schedule', 'tips')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_conversations ON ai_conversations(user_id, created_at);

-- Scheduled Sessions table
CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id INT,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped', 'rescheduled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_schedule ON scheduled_sessions(user_id, start_time);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(100),
  priority INT DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  estimated_duration INT DEFAULT 30,
  due_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tasks ON tasks(user_id, status);

-- Add foreign key to scheduled_sessions for tasks
ALTER TABLE scheduled_sessions 
ADD CONSTRAINT fk_scheduled_task 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;