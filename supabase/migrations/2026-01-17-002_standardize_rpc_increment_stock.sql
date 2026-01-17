-- ============================================================
-- Standardize rpc_increment_stock to use named arguments
-- (product_id, amount) and return boolean
-- ============================================================

-- Drop existing function (any signature)
DROP FUNCTION IF EXISTS public.rpc_increment_stock(uuid, numeric);
DROP FUNCTION IF EXISTS public.rpc_increment_stock(p_product_id uuid, p_qty numeric);

-- Create standardized function with named arguments
CREATE FUNCTION public.rpc_increment_stock(
    product_id uuid,
    amount numeric
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer;
BEGIN
    -- Validate amount
    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Invalid amount: must be positive';
    END IF;

    -- Atomic update: increment stock
    UPDATE public.products
    SET stock = stock + amount
    WHERE id = product_id;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    -- Return true if at least one row was updated
    RETURN v_updated > 0;
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
