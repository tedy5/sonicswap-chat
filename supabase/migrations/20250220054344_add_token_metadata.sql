-- Add token metadata columns to user_contract_balances
ALTER TABLE public.user_contract_balances
ADD COLUMN token_symbol text,
ADD COLUMN token_decimals integer DEFAULT 18 NOT NULL;

-- Add index for symbol searches
CREATE INDEX idx_user_contract_balances_symbol
ON public.user_contract_balances(token_symbol);
