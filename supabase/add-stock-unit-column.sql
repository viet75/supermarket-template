-- ============================================================
-- 🔧 AGGIUNTA COLONNA stock_unit ALLA TABELLA products
-- ============================================================
-- Aggiunge la colonna stock_unit per gestire stock a unità minime intere
-- - stock_unit = 1 per prodotti a pezzo (per_unit)
-- - stock_unit = 100 per prodotti al kg (per_kg, 1 unità = 100g)
-- ============================================================

DO $$
BEGIN
    -- Aggiungi stock_unit se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_unit'
    ) THEN
        ALTER TABLE products ADD COLUMN stock_unit INTEGER DEFAULT 1;
        -- Imposta stock_unit = 100 per prodotti al kg, 1 per prodotti a pezzo
        UPDATE products SET stock_unit = 100 WHERE unit_type = 'per_kg';
        UPDATE products SET stock_unit = 1 WHERE unit_type = 'per_unit' OR unit_type IS NULL;
        RAISE NOTICE 'Colonna stock_unit aggiunta';
    END IF;

    RAISE NOTICE '✅ Colonna stock_unit verificata/aggiunta con successo';
END $$;

