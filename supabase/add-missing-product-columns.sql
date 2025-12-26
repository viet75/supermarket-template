-- ============================================================
-- 🔧 AGGIUNTA COLONNE MANCANTI ALLA TABELLA products
-- ============================================================
-- Questo script aggiunge tutte le colonne mancanti alla tabella products
-- che sono utilizzate dal codice ma non esistono nello schema iniziale.
--
-- IMPORTANTE: Esegui questo script nel SQL Editor di Supabase
-- ============================================================

DO $$
BEGIN
    -- Aggiungi description se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description TEXT;
        RAISE NOTICE 'Colonna description aggiunta';
    END IF;

    -- Aggiungi price_sale se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_sale'
    ) THEN
        ALTER TABLE products ADD COLUMN price_sale NUMERIC(10,2);
        RAISE NOTICE 'Colonna price_sale aggiunta';
    END IF;

    -- Aggiungi image_url se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Colonna image_url aggiunta';
    END IF;

    -- Aggiungi images se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'images'
    ) THEN
        ALTER TABLE products ADD COLUMN images JSONB;
        RAISE NOTICE 'Colonna images aggiunta';
    END IF;

    -- Aggiungi stock se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock'
    ) THEN
        ALTER TABLE products ADD COLUMN stock NUMERIC(10,2);
        RAISE NOTICE 'Colonna stock aggiunta';
    END IF;

    -- Aggiungi is_active se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
        -- Imposta tutti i prodotti esistenti come attivi
        UPDATE products SET is_active = true WHERE is_active IS NULL;
        RAISE NOTICE 'Colonna is_active aggiunta';
    END IF;

    -- Aggiungi sort_order se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 100;
        -- Imposta un sort_order di default per i prodotti esistenti
        UPDATE products SET sort_order = 100 WHERE sort_order IS NULL;
        RAISE NOTICE 'Colonna sort_order aggiunta';
    END IF;

    -- Aggiungi unit_type se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'unit_type'
    ) THEN
        ALTER TABLE products ADD COLUMN unit_type TEXT 
        DEFAULT 'per_unit' 
        CHECK (unit_type IN ('per_unit', 'per_kg') OR unit_type IS NULL);
        -- Imposta il default per i prodotti esistenti
        UPDATE products SET unit_type = 'per_unit' WHERE unit_type IS NULL;
        RAISE NOTICE 'Colonna unit_type aggiunta';
    END IF;

    RAISE NOTICE '✅ Tutte le colonne sono state verificate/aggiunte con successo';
END $$;

-- ============================================================
-- ✅ COLONNE AGGIUNTE
-- ============================================================
-- Le seguenti colonne sono ora disponibili nella tabella products:
-- - description (TEXT, nullable)
-- - price_sale (NUMERIC(10,2), nullable)
-- - image_url (TEXT, nullable)
-- - images (JSONB, nullable)
-- - stock (NUMERIC(10,2), nullable)
-- - is_active (BOOLEAN, default true)
-- - sort_order (INTEGER, default 100)
-- - unit_type (TEXT, default 'per_unit', valori: 'per_unit' | 'per_kg' | NULL)
-- ============================================================































