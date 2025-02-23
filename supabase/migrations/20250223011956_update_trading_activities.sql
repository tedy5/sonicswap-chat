-- Drop the existing table
DROP TABLE IF EXISTS public.trading_activities;

-- Recreate the table with NUMERIC(39,0) for amounts and swap_source column
CREATE TABLE public.trading_activities (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  transaction_hash text,
  trade_type text NOT NULL,
  from_token_address text NOT NULL,
  to_token_address text NOT NULL,
  from_amount NUMERIC(39,0) NOT NULL,
  to_amount NUMERIC(39,0),
  status text NOT NULL,
  swap_source text NOT NULL,  -- New column
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  metadata jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT trading_activities_pkey PRIMARY KEY (id),
  CONSTRAINT trading_activities_tx_hash_unique UNIQUE (transaction_hash),
  CONSTRAINT trading_activities_user_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT valid_status CHECK (
    status = ANY (ARRAY[
      'PENDING',
      'COMPLETED',
      'FAILED'
    ])
  ),
  CONSTRAINT valid_trade_type CHECK (
    trade_type = ANY (ARRAY[
      'SWAP',
      'DEPOSIT',
      'WITHDRAWAL'
    ])
  ),
  CONSTRAINT valid_swap_source CHECK (  -- New constraint
    swap_source = ANY (ARRAY[
      'CONTRACT',
      'WALLET'
    ])
  )
);

-- Recreate the indexes
CREATE INDEX idx_trading_activities_user
ON public.trading_activities USING btree (user_id);

CREATE INDEX idx_trading_activities_status
ON public.trading_activities USING btree (status);

CREATE INDEX idx_trading_activities_created
ON public.trading_activities USING btree (created_at);

-- Recreate the triggers
CREATE TRIGGER update_user_last_active_trading
AFTER INSERT ON trading_activities
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_trading_activities_timestamp
BEFORE UPDATE ON trading_activities
FOR EACH ROW
EXECUTE FUNCTION update_trading_timestamp();