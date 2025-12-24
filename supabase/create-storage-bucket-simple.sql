-- ============================================================
-- 📦 CREAZIONE BUCKET STORAGE PER PRODOTTI (VERSIONE SEMPLICE)
-- ============================================================
-- Questo script crea solo il bucket "products" senza le policy RLS.
-- Le policy non sono necessarie se usi il service role key (che bypassa RLS).
--
-- IMPORTANTE: Esegui questo script nel SQL Editor di Supabase
-- ============================================================

-- Crea il bucket "products" se non esiste
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'products',
    'products',
    true,  -- bucket pubblico (le immagini devono essere accessibili pubblicamente)
    5242880,  -- limite 5MB (5 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']  -- solo immagini
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ✅ BUCKET CREATO
-- ============================================================
-- Il bucket "products" è ora disponibile per l'upload delle immagini.
-- Le immagini saranno accessibili pubblicamente all'URL:
-- https://[PROJECT-REF].supabase.co/storage/v1/object/public/products/images/[filename]
-- ============================================================




























