-- Add stock_scaled flag to avoid double scaling
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stock_scaled boolean NOT NULL DEFAULT false;
