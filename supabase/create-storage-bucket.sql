-- ============================================================
-- 📦 CREAZIONE BUCKET STORAGE PER PRODOTTI
-- ============================================================
-- Questo script crea il bucket "products" in Supabase Storage
-- per permettere l'upload delle immagini dei prodotti.
--
-- IMPORTANTE: Esegui questo script nel SQL Editor di Supabase
-- oppure tramite la CLI: supabase db execute -f supabase/create-storage-bucket.sql
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
-- 🔐 POLICIES DI SICUREZZA (RLS)
-- ============================================================
-- Configura le policy per permettere:
-- - Lettura pubblica (tutti possono vedere le immagini)
-- - Scrittura solo per utenti autenticati con ruolo admin

-- Policy per lettura pubblica (SELECT)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Policy per upload (INSERT) - solo admin
DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
CREATE POLICY "Admin can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'products' AND
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Policy per aggiornamento (UPDATE) - solo admin
DROP POLICY IF EXISTS "Admin can update images" ON storage.objects;
CREATE POLICY "Admin can update images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'products' AND
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Policy per eliminazione (DELETE) - solo admin
DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;
CREATE POLICY "Admin can delete images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'products' AND
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- ============================================================
-- ✅ BUCKET CREATO
-- ============================================================
-- Il bucket "products" è ora disponibile per l'upload delle immagini.
-- Le immagini saranno accessibili pubblicamente all'URL:
-- https://[PROJECT-REF].supabase.co/storage/v1/object/public/products/images/[filename]
-- ============================================================

