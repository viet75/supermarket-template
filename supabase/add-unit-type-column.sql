-- ============================================================
-- 🔧 AGGIUNTA COLONNA unit_type ALLA TABELLA products
-- ============================================================
-- Questo script aggiunge la colonna unit_type che manca nella tabella products.
-- La colonna è usata per distinguere tra prodotti venduti "per unità" o "per kg".
--
-- IMPORTANTE: Esegui questo script nel SQL Editor di Supabase
-- ============================================================

-- Aggiungi la colonna unit_type se non esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'unit_type'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN unit_type TEXT 
        DEFAULT 'per_unit' 
        CHECK (unit_type IN ('per_unit', 'per_kg') OR unit_type IS NULL);
        
        -- Imposta il default per i prodotti esistenti
        UPDATE products 
        SET unit_type = 'per_unit' 
        WHERE unit_type IS NULL;
        
        RAISE NOTICE 'Colonna unit_type aggiunta con successo';
    ELSE
        RAISE NOTICE 'Colonna unit_type già esistente';
    END IF;
END $$;

-- ============================================================
-- ✅ COLONNA AGGIUNTA
-- ============================================================
-- La colonna unit_type è ora disponibile nella tabella products.
-- Valori possibili: 'per_unit' (default), 'per_kg', o NULL
-- ============================================================

































