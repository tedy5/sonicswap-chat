-- Drop the existing index first
DROP INDEX IF EXISTS idx_chat_messages_conversation;

-- Remove conversation_id column
ALTER TABLE chat_messages
DROP COLUMN conversation_id;

-- Create optimized index for user's recent messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_recent
ON chat_messages(user_id, created_at DESC);