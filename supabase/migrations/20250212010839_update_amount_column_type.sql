-- Modify the amount column to use text type
ALTER TABLE bridge_transactions ALTER COLUMN amount TYPE text USING amount::text;