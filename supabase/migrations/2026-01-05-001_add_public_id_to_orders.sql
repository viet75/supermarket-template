-- Add public_id column to orders for efficient ID-based search
-- This column stores the first 8 characters of the UUID for quick lookup

-- Add column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS public_id text;

-- Backfill existing records: set public_id = left(id::text, 8) where null
UPDATE public.orders
SET public_id = left(id::text, 8)
WHERE public_id IS NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_public_id ON public.orders(public_id);

-- Add unique constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_public_id_unique'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_public_id_unique UNIQUE (public_id);
    END IF;
END $$;

-- Trigger function to auto-generate public_id on INSERT if null
CREATE OR REPLACE FUNCTION public.set_orders_public_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_id IS NULL THEN
        NEW.public_id := left(NEW.id::text, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_set_orders_public_id ON public.orders;
CREATE TRIGGER trigger_set_orders_public_id
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_orders_public_id();

