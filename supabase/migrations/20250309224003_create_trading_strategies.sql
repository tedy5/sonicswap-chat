CREATE TABLE IF NOT EXISTS public.pending_trading_strategies (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  strategy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('pending', 'used', 'expired'))
);

CREATE INDEX idx_pending_strategies_user_tokens ON public.pending_trading_strategies(user_id, token_in, token_out, status);