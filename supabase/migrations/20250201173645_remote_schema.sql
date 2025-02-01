-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table to store wallet addresses
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table linked to users
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    conversation_id TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for getting latest messages and conversations
CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);

-- Swaps table for Sonic chain
CREATE TABLE user_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount_in NUMERIC NOT NULL,
    amount_out NUMERIC NOT NULL,
    tx_hash TEXT UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Store additional swap details (like slippage, route)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Limit orders table for Sonic chain
CREATE TABLE limit_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount_in NUMERIC NOT NULL,
    target_price NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'executed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE,
    execution_tx_hash TEXT UNIQUE,
    -- Store additional order details (like expiry, min output)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Bridge transactions table for cross-chain transfers to/from Sonic
CREATE TABLE bridge_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    source_chain_id INTEGER NOT NULL,
    destination_chain_id INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('to_sonic', 'from_sonic')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    source_tx_hash TEXT,
    destination_tx_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_swaps_user_id ON user_swaps(user_id);
CREATE INDEX idx_swaps_status ON user_swaps(status);
CREATE INDEX idx_limit_orders_user_id ON limit_orders(user_id);
CREATE INDEX idx_limit_orders_status ON limit_orders(status);
CREATE INDEX idx_bridge_transactions_user_id ON bridge_transactions(user_id);
CREATE INDEX idx_bridge_transactions_status ON bridge_transactions(status);

-- Add timestamps triggers for last_active_at
CREATE OR REPLACE FUNCTION update_last_active_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET last_active_at = CURRENT_TIMESTAMP
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_last_active_chat
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_user_last_active_swap
AFTER INSERT ON user_swaps
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_user_last_active_limit_order
AFTER INSERT ON limit_orders
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_user_last_active_bridge
AFTER INSERT ON bridge_transactions
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();