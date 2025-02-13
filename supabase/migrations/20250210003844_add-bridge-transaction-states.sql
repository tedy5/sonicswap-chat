ALTER TABLE bridge_transactions
DROP CONSTRAINT bridge_transactions_state_check;

ALTER TABLE bridge_transactions
ADD CONSTRAINT bridge_transactions_state_check CHECK (
  state = ANY (ARRAY[
    'Created'::text,
    'ClaimedUnlock'::text,
    'Cancelled'::text,
    'Fulfilled'::text,
    'SentUnlock'::text,
    'OrderCancelled'::text,
    'ClaimedOrderCancel'::text
  ])
);