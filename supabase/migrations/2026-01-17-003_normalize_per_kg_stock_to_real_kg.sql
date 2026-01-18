-- ============================================================
-- Normalize per_kg stock from "decimi" to real kg
-- ============================================================
-- 
-- Per unit_type='per_kg', lo stock era salvato in "decimi" (es: 102 = 10.2kg).
-- Questo creava problemi con decrement/increment che lavorano in kg reali.
-- 
-- Questa migration normalizza tutti i prodotti per_kg esistenti:
-- UPDATE products SET stock = stock / 10 WHERE unit_type='per_kg'
-- 
-- Dopo questa migration:
-- - products.stock per per_kg è in kg reali (10.2, 8.5...)
-- - order_items.quantity resta in kg
-- - RPC decrement/increment lavorano direttamente in kg
-- ============================================================

-- Normalizza stock per_kg da decimi a kg reali
UPDATE public.products
SET stock = stock / 10
WHERE unit_type = 'per_kg' 
  AND stock IS NOT NULL
  AND stock > 0;

-- Commento per documentazione
COMMENT ON COLUMN public.products.stock IS 
'Stock disponibile. Per per_unit: quantità intera (pezzi). Per per_kg: quantità decimale in kg (es. 10.2 = 10.2kg).';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
