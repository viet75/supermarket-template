-- ============================================================
-- 🗄️  SUPERMARKET PWA TEMPLATE - PRODUCTION SETUP
-- One-shot idempotent database setup script
-- ============================================================

-- ============================================================
-- 📦  BASE TABLES
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

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    quantity numeric(10,2) NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
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
-- 🔧  ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- Products: additional columns
DO $$
BEGIN
    -- description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description TEXT;
    END IF;

    -- price_sale
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_sale'
    ) THEN
        ALTER TABLE products ADD COLUMN price_sale NUMERIC(10,2);
    END IF;

    -- image_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;

    -- images
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'images'
    ) THEN
        ALTER TABLE products ADD COLUMN images JSONB;
    END IF;

    -- stock
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock'
    ) THEN
        ALTER TABLE products ADD COLUMN stock NUMERIC(10,2);
    END IF;

    -- is_active
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE products SET is_active = true WHERE is_active IS NULL;
    END IF;

    -- sort_order
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 100;
        UPDATE products SET sort_order = 100 WHERE sort_order IS NULL;
    END IF;

    -- unit_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'unit_type'
    ) THEN
        ALTER TABLE products ADD COLUMN unit_type TEXT 
        DEFAULT 'per_unit' 
        CHECK (unit_type IN ('per_unit', 'per_kg') OR unit_type IS NULL);
        UPDATE products SET unit_type = 'per_unit' WHERE unit_type IS NULL;
    END IF;
END $$;

-- Orders: additional columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS stock_scaled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS public_id text,
ADD COLUMN IF NOT EXISTS customer_first_name text,
ADD COLUMN IF NOT EXISTS customer_last_name text;

-- Order Items: price column (already has default in table definition, but ensure it exists)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 📊  INDEXES AND CONSTRAINTS
-- ============================================================

-- Orders: public_id index and unique constraint
CREATE INDEX IF NOT EXISTS idx_orders_public_id ON public.orders(public_id);

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

-- Orders: customer name indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_first_name ON public.orders(customer_first_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_last_name ON public.orders(customer_last_name);

-- ============================================================
-- 🔄  BACKFILL DATA
-- ============================================================

-- Orders: backfill public_id from id
UPDATE public.orders
SET public_id = left(id::text, 8)
WHERE public_id IS NULL;

-- Orders: backfill customer names from address JSON
UPDATE public.orders
SET 
    customer_first_name = COALESCE(
        address->>'firstName',
        address->>'first_name',
        ''
    ),
    customer_last_name = COALESCE(
        address->>'lastName',
        address->>'last_name',
        ''
    )
WHERE customer_first_name IS NULL OR customer_last_name IS NULL;

-- ============================================================
-- ⚙️  FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function: auto-generate public_id on INSERT
CREATE OR REPLACE FUNCTION public.set_orders_public_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_id IS NULL THEN
        NEW.public_id := left(NEW.id::text, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: set public_id on INSERT
DROP TRIGGER IF EXISTS trigger_set_orders_public_id ON public.orders;
CREATE TRIGGER trigger_set_orders_public_id
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_orders_public_id();

-- Function: sync customer names from address JSON
CREATE OR REPLACE FUNCTION public.sync_customer_names_from_address()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract first_name from address JSON (support both camelCase and snake_case)
    NEW.customer_first_name := COALESCE(
        NEW.address->>'firstName',
        NEW.address->>'first_name',
        ''
    );
    
    -- Extract last_name from address JSON (support both camelCase and snake_case)
    NEW.customer_last_name := COALESCE(
        NEW.address->>'lastName',
        NEW.address->>'last_name',
        ''
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: sync customer names on INSERT/UPDATE of address
DROP TRIGGER IF EXISTS trigger_sync_customer_names ON public.orders;
CREATE TRIGGER trigger_sync_customer_names
    BEFORE INSERT OR UPDATE OF address ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_customer_names_from_address();

-- ============================================================
-- 📦  STORAGE BUCKETS
-- ============================================================

-- Create products bucket for image uploads
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
-- ✅  SETUP COMPLETE
-- ============================================================
-- This script is idempotent and can be run multiple times safely.
-- All tables, columns, indexes, constraints, triggers, and storage
-- buckets are created with IF NOT EXISTS or equivalent checks.
-- ============================================================
