-- Add media column to ai_conversations table
ALTER TABLE ai_conversations 
ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]';

-- Create index for media queries
CREATE INDEX IF NOT EXISTS idx_ai_conversations_media ON ai_conversations USING GIN(media);
