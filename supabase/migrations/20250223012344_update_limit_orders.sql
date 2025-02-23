-- Drop the existing table
DROP TABLE IF EXISTS public.limit_orders;

-- Recreate the table with NUMERIC(39,0) for amounts
CREATE TABLE public.limit_orders (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  token_in text NOT NULL,
  token_out text NOT NULL,
  amount_in NUMERIC(39,0) NOT NULL,    -- Changed from numeric to NUMERIC(39,0)
  target_price NUMERIC(39,0) NOT NULL,  -- Changed from numeric to NUMERIC(39,0)
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  executed_at timestamp with time zone,
  execution_tx_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT limit_orders_pkey PRIMARY KEY (id),
  CONSTRAINT limit_orders_execution_tx_hash_key UNIQUE (execution_tx_hash),
  CONSTRAINT limit_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT limit_orders_status_check CHECK (
    status = ANY (ARRAY[
      'pending',
      'executed',
      'cancelled'
    ])
  )
);

-- Recreate the indexes
CREATE INDEX idx_limit_orders_user_id
ON public.limit_orders USING btree (user_id);

CREATE INDEX idx_limit_orders_status
ON public.limit_orders USING btree (status);

-- Recreate the trigger
CREATE TRIGGER update_user_last_active_limit_order
AFTER INSERT ON limit_orders
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();