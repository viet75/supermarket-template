-- Add payment_status column to orders to align with API expectations
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';



























