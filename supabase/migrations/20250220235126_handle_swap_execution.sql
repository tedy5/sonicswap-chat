CREATE OR REPLACE FUNCTION handle_swap_execution(
  p_user_id UUID,
  p_transaction_hash TEXT,
  p_token_in TEXT,
  p_token_out TEXT,
  p_amount_in TEXT,
  p_amount_out TEXT,
  p_token_in_symbol TEXT,
  p_token_in_decimals INTEGER,
  p_token_out_symbol TEXT,
  p_token_out_decimals INTEGER,
  p_swap_source TEXT  -- New parameter
) RETURNS void AS $$
DECLARE
  v_amount_in NUMERIC(39,0);
  v_amount_out NUMERIC(39,0);
  v_new_balance NUMERIC(39,0);
BEGIN
  -- Safely convert the string amounts to NUMERIC
  v_amount_in := CAST(p_amount_in AS NUMERIC(39,0));
  v_amount_out := CAST(p_amount_out AS NUMERIC(39,0));

  -- Record the swap in trading_activities
  INSERT INTO trading_activities (
    user_id,
    transaction_hash,
    trade_type,
    from_token_address,
    to_token_address,
    from_amount,
    to_amount,
    status,
    swap_source,  -- New column
    metadata
  ) VALUES (
    p_user_id,
    p_transaction_hash,
    'SWAP',
    p_token_in,
    p_token_out,
    v_amount_in,
    v_amount_out,
    'COMPLETED',
    p_swap_source,  -- New value
    jsonb_build_object(
      'from_symbol', p_token_in_symbol,
      'from_decimals', p_token_in_decimals,
      'to_symbol', p_token_out_symbol,
      'to_decimals', p_token_out_decimals
    )
  );

  -- Only update balances if this is a contract swap
  IF p_swap_source = 'CONTRACT' THEN
    -- Calculate new balance for input token
    SELECT balance - v_amount_in INTO v_new_balance
    FROM user_contract_balances
    WHERE user_id = p_user_id AND token_address = p_token_in;

    -- If new balance is zero or negative, remove the record
    IF v_new_balance <= 0 THEN
      DELETE FROM user_contract_balances
      WHERE user_id = p_user_id AND token_address = p_token_in;
    ELSE
      -- Update input token balance (decrease)
      UPDATE user_contract_balances
      SET
        balance = v_new_balance,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id
        AND token_address = p_token_in;
    END IF;

    -- Update or insert output token balance (increase)
    INSERT INTO user_contract_balances (
      user_id,
      token_address,
      balance,
      token_decimals,
      token_symbol
    ) VALUES (
      p_user_id,
      p_token_out,
      v_amount_out,
      p_token_out_decimals,
      p_token_out_symbol
    )
    ON CONFLICT (user_id, token_address)
    DO UPDATE SET
      balance = user_contract_balances.balance + v_amount_out,
      last_updated_at = CURRENT_TIMESTAMP,
      token_decimals = p_token_out_decimals,
      token_symbol = p_token_out_symbol;
  END IF;

END;
$$ LANGUAGE plpgsql;