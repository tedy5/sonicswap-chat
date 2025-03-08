-- Rename target_price to amount_out_min
ALTER TABLE public.limit_orders
RENAME COLUMN target_price TO amount_out_min;

-- Add order_id column
ALTER TABLE public.limit_orders
ADD COLUMN order_id text;

-- Create index on order_id for faster lookups
CREATE INDEX idx_limit_orders_order_id ON public.limit_orders (order_id);

-- Update status check constraint to use new status values
ALTER TABLE public.limit_orders
DROP CONSTRAINT limit_orders_status_check;

ALTER TABLE public.limit_orders
ADD CONSTRAINT limit_orders_status_check CHECK (
  status = ANY (ARRAY['active'::text, 'executed'::text, 'cancelled'::text])
);

