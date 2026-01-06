-- Add customer_first_name and customer_last_name columns to orders
-- These columns are denormalized from the address JSON for reliable search

-- Add columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_first_name text,
ADD COLUMN IF NOT EXISTS customer_last_name text;

-- Backfill existing records from address JSON
-- Support both camelCase (firstName/lastName) and snake_case (first_name/last_name)
UPDATE public.orders
SET 
    customer_first_name = COALESCE(
        address->>'firstName',
        address->>'first_name',
        ''
    ),
    customer_last_name = COALESCE(
        address->>'lastName',
        address->>'last_name',
        ''
    )
WHERE customer_first_name IS NULL OR customer_last_name IS NULL;

-- Create indexes for fast search
CREATE INDEX IF NOT EXISTS idx_orders_customer_first_name ON public.orders(customer_first_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_last_name ON public.orders(customer_last_name);

-- Trigger function to sync customer names from address JSON on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.sync_customer_names_from_address()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract first_name from address JSON (support both camelCase and snake_case)
    NEW.customer_first_name := COALESCE(
        NEW.address->>'firstName',
        NEW.address->>'first_name',
        ''
    );
    
    -- Extract last_name from address JSON (support both camelCase and snake_case)
    NEW.customer_last_name := COALESCE(
        NEW.address->>'lastName',
        NEW.address->>'last_name',
        ''
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger BEFORE INSERT OR UPDATE OF address
DROP TRIGGER IF EXISTS trigger_sync_customer_names ON public.orders;
CREATE TRIGGER trigger_sync_customer_names
    BEFORE INSERT OR UPDATE OF address ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_customer_names_from_address();

