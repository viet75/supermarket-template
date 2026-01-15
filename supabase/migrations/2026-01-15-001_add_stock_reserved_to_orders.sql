-- ============================================================
-- Add stock_reserved column to orders table
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;

-- ============================================================
-- RPC Functions for Atomic Stock Operations
-- ============================================================

-- Decrement stock atomically (only if sufficient stock available)
-- Returns true if update succeeded, false if insufficient stock
CREATE OR REPLACE FUNCTION public.rpc_decrement_stock(
    p_product_id uuid,
    p_qty numeric
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer;
BEGIN
    -- Atomic update: only decrement if stock >= qty
    UPDATE public.products
    SET stock = stock - p_qty
    WHERE id = p_product_id
      AND stock >= p_qty;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    -- Return true if at least one row was updated
    RETURN v_updated > 0;
END;
$$;

-- Increment stock atomically
-- Returns true if update succeeded
CREATE OR REPLACE FUNCTION public.rpc_increment_stock(
    p_product_id uuid,
    p_qty numeric
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer;
BEGIN
    -- Atomic update: increment stock
    UPDATE public.products
    SET stock = stock + p_qty
    WHERE id = p_product_id;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    -- Return true if at least one row was updated
    RETURN v_updated > 0;
END;
$$;

