-- Add tool_invocations column (up migration)
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS tool_invocations JSONB;

---- Create an index for better performance when querying JSON
CREATE INDEX IF NOT EXISTS idx_chat_messages_tool_invocations
ON chat_messages USING GIN (tool_invocations);