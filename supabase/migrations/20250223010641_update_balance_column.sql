-- Drop the existing table
DROP TABLE IF EXISTS public.user_contract_balances;

-- Recreate the table with NUMERIC(39,0) for balance
CREATE TABLE public.user_contract_balances (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  token_address text NOT NULL,
  balance NUMERIC(39,0) NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  metadata jsonb DEFAULT '{}'::jsonb,
  token_symbol text,
  token_decimals integer NOT NULL DEFAULT 18,

  CONSTRAINT user_contract_balances_pkey PRIMARY KEY (id),
  CONSTRAINT user_contract_balances_unique UNIQUE (user_id, token_address),
  CONSTRAINT user_contract_balances_user_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Recreate the indexes
CREATE INDEX idx_user_contract_balances_user
ON public.user_contract_balances USING btree (user_id);

CREATE INDEX idx_user_contract_balances_token
ON public.user_contract_balances USING btree (token_address);

CREATE INDEX idx_user_contract_balances_symbol
ON public.user_contract_balances USING btree (token_symbol);

CREATE INDEX idx_user_contract_balances_balance
ON public.user_contract_balances USING btree (balance)
WHERE (balance > 0);

-- Recreate the trigger
CREATE TRIGGER update_user_last_active_balance
AFTER INSERT OR UPDATE ON user_contract_balances
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();