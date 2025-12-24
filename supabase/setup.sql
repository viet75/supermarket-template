-- ============================================================
-- 🗄️  SUPERMARKET PWA TEMPLATE - SETUP DATABASE
-- Versione: 1.3 (con tabella profiles)
-- ============================================================

-- ============================================================
-- ⚠️  RESET DATABASE DEMO (senza eliminare tabelle)
-- Svuota le tabelle se già esistono, per evitare duplicati.
-- ============================================================
DO $$
BEGIN
    IF to_regclass('public.products') IS NOT NULL THEN
        TRUNCATE TABLE products RESTART IDENTITY CASCADE;
    END IF;
    IF to_regclass('public.categories') IS NOT NULL THEN
        TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
    END IF;
    IF to_regclass('public.orders') IS NOT NULL THEN
        TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
    END IF;
    IF to_regclass('public.store_settings') IS NOT NULL THEN
        TRUNCATE TABLE store_settings RESTART IDENTITY CASCADE;
    END IF;
    IF to_regclass('public.profiles') IS NOT NULL THEN
        TRUNCATE TABLE profiles RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- ============================================================
-- 📦  TABELLE BASE
-- ============================================================

-- Categorie prodotti
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    deleted_at timestamp with time zone
);

-- Prodotti
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
    image text,
    created_at timestamp DEFAULT now(),
    deleted_at timestamp with time zone
);


-- Ordini
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp DEFAULT now(),
    total numeric(10,2),
    status text DEFAULT 'pending',
    payment_method text,
    payment_status text DEFAULT 'pending'
);

-- Impostazioni negozio
CREATE TABLE IF NOT EXISTS store_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name text DEFAULT 'Supermarket Template',
    delivery_enabled boolean DEFAULT true,
    delivery_fee_base numeric(10,2) DEFAULT 0,
    delivery_fee_per_km numeric(10,2) DEFAULT 0.5,
    delivery_max_km numeric(10,2) DEFAULT 10,
    free_over numeric(10,2) DEFAULT 50,
    store_lat numeric(10,6),
    store_lng numeric(10,6)
);

-- Profili utenti (collegati a Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'customer',
    created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 🧩  DATI DEMO (esempio prodotti e categorie)
-- ============================================================

-- Categorie
INSERT INTO categories (name) VALUES
    ('Frutta'),
    ('Verdura'),
    ('Bevande'),
    ('Forno')
ON CONFLICT DO NOTHING;

-- Prodotti demo
INSERT INTO products (name, price, category_id, image) VALUES
  ('Mele Golden 1kg',        1.50, (SELECT id FROM categories WHERE name = 'Frutta'),  '/images/example-frutta.jpg'),
  ('Banane 1kg',             1.60, (SELECT id FROM categories WHERE name = 'Frutta'),  '/images/example-banane.jpg'),

  ('Pomodori 1kg',           2.00, (SELECT id FROM categories WHERE name = 'Verdura'), '/images/example-verdura.jpg'),
  ('Insalata mista 250g',    1.10, (SELECT id FROM categories WHERE name = 'Verdura'), '/images/example-insalata.jpg'),

  ('Pane Fresco 500g',       1.00, (SELECT id FROM categories WHERE name = 'Forno'),   '/images/example-pane.jpg'),
  ('Panini morbidi x6',      1.90, (SELECT id FROM categories WHERE name = 'Forno'),   '/images/example-panini.jpg'),

  ('Acqua Naturale 1L',      0.80, (SELECT id FROM categories WHERE name = 'Bevande'), '/images/example-acqua.jpg'),
  ('Bibita cola 1.5L',       1.50, (SELECT id FROM categories WHERE name = 'Bevande'), '/images/example-cola.jpg'),
  ('Succo di frutta pesca',  1.20, (SELECT id FROM categories WHERE name = 'Bevande'), '/images/example-succo.jpg');

ON CONFLICT DO NOTHING;

-- Impostazioni negozio (demo)
INSERT INTO store_settings (
    store_name,
    delivery_enabled,
    delivery_fee_base,
    delivery_fee_per_km,
    delivery_max_km,
    free_over,
    store_lat,
    store_lng
)
VALUES ('Supermarket Template', true, 0, 0.5, 10, 50, 40.000000, 16.000000)
ON CONFLICT DO NOTHING;

-- ======================================
-- 🧩 Creazione utente admin demo
-- ======================================

-- Crea un utente fittizio in Supabase Auth
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  gen_random_uuid(),
  'admin@demo.com',
  crypt('admin123', gen_salt('bf'))
);

-- Crea il relativo profilo collegato con ruolo admin
INSERT INTO public.profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@demo.com';

-- Conferma completata
COMMIT;

-- ============================================================
-- ✅  FINE SETUP
-- Esegui questo script una sola volta al setup iniziale.
-- ============================================================
