-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE limit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_transactions ENABLE ROW LEVEL SECURITY;

-- Create service role policies (for server-side operations)
CREATE POLICY "Service role full access to users"
ON users FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to chat_messages"
ON chat_messages FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to user_swaps"
ON user_swaps FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to limit_orders"
ON limit_orders FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to bridge_transactions"
ON bridge_transactions FOR ALL
TO service_role
USING (true);

-- Deny direct access to authenticated users (they should go through the API)
CREATE POLICY "No direct access to users"
ON users FOR ALL
TO authenticated
USING (false);

CREATE POLICY "No direct access to chat_messages"
ON chat_messages FOR ALL
TO authenticated
USING (false);

CREATE POLICY "No direct access to user_swaps"
ON user_swaps FOR ALL
TO authenticated
USING (false);

CREATE POLICY "No direct access to limit_orders"
ON limit_orders FOR ALL
TO authenticated
USING (false);

CREATE POLICY "No direct access to bridge_transactions"
ON bridge_transactions FOR ALL
TO authenticated
USING (false);

-- Add additional security indexes
CREATE INDEX IF NOT EXISTS idx_users_id_wallet ON users(id, wallet_address);