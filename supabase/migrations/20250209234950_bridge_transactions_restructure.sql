-- Update bridge_transactions table structure
-- First, let's add new columns for from/to token structure
ALTER TABLE public.bridge_transactions
ADD COLUMN token_in_address text,
ADD COLUMN token_in_chain_id integer,
ADD COLUMN token_in_symbol text,
ADD COLUMN token_in_decimals integer,
ADD COLUMN token_out_address text,
ADD COLUMN token_out_chain_id integer,
ADD COLUMN token_out_symbol text,
ADD COLUMN token_out_decimals integer,
ADD COLUMN order_id text,
ADD COLUMN state text,
ADD COLUMN external_call_state text,
ADD COLUMN percent_fee numeric,
ADD COLUMN fix_fee numeric,
ADD COLUMN unlock_tx_hash text,
ADD COLUMN source_block_number bigint,
ADD COLUMN destination_block_number bigint,
ADD COLUMN unlock_block_number bigint;

-- Drop old columns
ALTER TABLE public.bridge_transactions
DROP COLUMN direction,
DROP COLUMN token,
DROP COLUMN source_chain_id,
DROP COLUMN destination_chain_id;

-- Add constraint for state
ALTER TABLE public.bridge_transactions
ADD CONSTRAINT bridge_transactions_state_check CHECK (
    state = any (array['Created'::text, 'ClaimedUnlock'::text, 'Cancelled'::text])
);

-- Add unique constraint for order_id
ALTER TABLE public.bridge_transactions
ADD CONSTRAINT bridge_transactions_order_id_key UNIQUE (order_id);