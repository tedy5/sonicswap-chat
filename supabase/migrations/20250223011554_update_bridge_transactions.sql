-- Drop the existing table
DROP TABLE IF EXISTS public.bridge_transactions;

-- Recreate the table with NUMERIC(39,0) for amounts
CREATE TABLE public.bridge_transactions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount NUMERIC(39,0) NOT NULL,  -- Changed from text to NUMERIC(39,0)
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  source_tx_hash text,
  destination_tx_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,
  token_in_address text,
  token_in_chain_id integer,
  token_in_symbol text,
  token_in_decimals integer,
  token_out_address text,
  token_out_chain_id integer,
  token_out_symbol text,
  token_out_decimals integer,
  order_id text,
  state text,
  external_call_state text,
  percent_fee NUMERIC(39,0),  -- Changed from numeric to NUMERIC(39,0)
  fix_fee NUMERIC(39,0),      -- Changed from numeric to NUMERIC(39,0)
  unlock_tx_hash text,
  source_block_number bigint,
  destination_block_number bigint,
  unlock_block_number bigint,

  CONSTRAINT bridge_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT bridge_transactions_order_id_key UNIQUE (order_id),
  CONSTRAINT bridge_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT bridge_transactions_state_check CHECK (
    state = ANY (ARRAY[
      'Created',
      'ClaimedUnlock',
      'Cancelled',
      'Fulfilled',
      'SentUnlock',
      'OrderCancelled',
      'ClaimedOrderCancel'
    ])
  ),
  CONSTRAINT bridge_transactions_status_check CHECK (
    status = ANY (ARRAY[
      'pending',
      'completed',
      'failed'
    ])
  )
);

-- Recreate the indexes
CREATE INDEX idx_bridge_transactions_user_id
ON public.bridge_transactions USING btree (user_id);

CREATE INDEX idx_bridge_transactions_status
ON public.bridge_transactions USING btree (status);

-- Recreate the trigger
CREATE TRIGGER update_user_last_active_bridge
AFTER INSERT ON bridge_transactions
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();