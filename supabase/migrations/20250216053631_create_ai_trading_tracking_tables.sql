-- Table for tracking balances in AI's contract
CREATE TABLE public.user_contract_balances (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    token_address text NOT NULL,
    balance numeric NOT NULL DEFAULT 0,
    last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_contract_balances_pkey PRIMARY KEY (id),
    CONSTRAINT user_contract_balances_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT user_contract_balances_unique UNIQUE (user_id, token_address),
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Table for tracking token allowances given to AI
CREATE TABLE public.user_token_allowances (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    token_address text NOT NULL,
    allowance numeric NOT NULL DEFAULT 0,
    last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_token_allowances_pkey PRIMARY KEY (id),
    CONSTRAINT user_token_allowances_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT user_token_allowances_unique UNIQUE (user_id, token_address),
    CONSTRAINT positive_allowance CHECK (allowance >= 0)
);

-- Table for tracking all trading activities
CREATE TABLE public.trading_activities (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    transaction_hash text,
    trade_type text NOT NULL, -- 'SWAP', 'DEPOSIT', 'WITHDRAWAL'
    from_token_address text NOT NULL,
    to_token_address text NOT NULL,
    from_amount numeric NOT NULL,
    to_amount numeric,
    status text NOT NULL, -- 'PENDING', 'COMPLETED', 'FAILED'
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT trading_activities_pkey PRIMARY KEY (id),
    CONSTRAINT trading_activities_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT trading_activities_tx_hash_unique UNIQUE (transaction_hash),
    CONSTRAINT valid_trade_type CHECK (trade_type IN ('SWAP', 'DEPOSIT', 'WITHDRAWAL')),
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);

-- Indexes for efficient querying
CREATE INDEX idx_user_contract_balances_user ON public.user_contract_balances(user_id);
CREATE INDEX idx_user_contract_balances_token ON public.user_contract_balances(token_address);
CREATE INDEX idx_user_contract_balances_balance ON public.user_contract_balances(balance) WHERE balance > 0;

CREATE INDEX idx_user_token_allowances_user ON public.user_token_allowances(user_id);
CREATE INDEX idx_user_token_allowances_token ON public.user_token_allowances(token_address);
CREATE INDEX idx_user_token_allowances_allowance ON public.user_token_allowances(allowance) WHERE allowance > 0;

CREATE INDEX idx_trading_activities_user ON public.trading_activities(user_id);
CREATE INDEX idx_trading_activities_status ON public.trading_activities(status);
CREATE INDEX idx_trading_activities_created ON public.trading_activities(created_at);

-- Triggers for updating user's last active timestamp
CREATE TRIGGER update_user_last_active_balance
    AFTER INSERT OR UPDATE ON public.user_contract_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_user_last_active_allowance
    AFTER INSERT OR UPDATE ON public.user_token_allowances
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active_timestamp();

CREATE TRIGGER update_user_last_active_trading
    AFTER INSERT ON public.trading_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active_timestamp();

-- Trigger for updating trading_activities updated_at
CREATE OR REPLACE FUNCTION update_trading_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trading_activities_timestamp
    BEFORE UPDATE ON public.trading_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_trading_timestamp();
