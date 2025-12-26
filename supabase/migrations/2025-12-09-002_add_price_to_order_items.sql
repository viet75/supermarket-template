-- Add price column to order_items to store item price at checkout time
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;



























