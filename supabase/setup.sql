-- ============================================================
-- 🗄️  SUPERMARKET PWA TEMPLATE - PRODUCTION SETUP
-- One-shot idempotent database setup script
-- ============================================================

-- ============================================================
-- 🧩 EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 📦 TABLES (BASE)
-- ============================================================

-- Categorie prodotti
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    deleted_at timestamptz
);

-- Prodotti
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    image text,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- Ordini
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    total numeric(10,2),
    status text DEFAULT 'pending',
    payment_method text,
    payment_status text DEFAULT 'pending'
);

-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    quantity numeric(10,2) NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Impostazioni negozio
CREATE TABLE IF NOT EXISTS public.store_settings (
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
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'customer',
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 🛠️  SAFE ALTER / BACKFILL (BEFORE FUNCTIONS REFERENCE COLUMNS)
-- ============================================================

-- Products: additional columns
DO $$
BEGIN
    -- description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='description'
    ) THEN
        ALTER TABLE public.products ADD COLUMN description text;
    END IF;

    -- price_sale
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='price_sale'
    ) THEN
        ALTER TABLE public.products ADD COLUMN price_sale numeric(10,2);
    END IF;

    -- image_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='image_url'
    ) THEN
        ALTER TABLE public.products ADD COLUMN image_url text;
    END IF;

    -- images
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='images'
    ) THEN
        ALTER TABLE public.products ADD COLUMN images jsonb;
    END IF;

    -- stock (IMPORTANTE: NOT NULL + DEFAULT 0 per evitare falsi "insufficient_stock")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='stock'
    ) THEN
        ALTER TABLE public.products ADD COLUMN stock numeric(10,2);
    END IF;

    -- is_active
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='is_active'
    ) THEN
        ALTER TABLE public.products ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    -- sort_order
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='sort_order'
    ) THEN
        ALTER TABLE public.products ADD COLUMN sort_order integer DEFAULT 100;
    END IF;

    -- unit_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='unit_type'
    ) THEN
        ALTER TABLE public.products
            ADD COLUMN unit_type text
            DEFAULT 'per_unit'
            CHECK (unit_type IN ('per_unit', 'per_kg') OR unit_type IS NULL);
    END IF;

    -- stock_unit
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='stock_unit'
    ) THEN
        ALTER TABLE public.products ADD COLUMN stock_unit text;
    END IF;

    -- stock_unlimited
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='stock_unlimited'
    ) THEN
        ALTER TABLE public.products ADD COLUMN stock_unlimited boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Backfill prodotti: valori null -> default coerenti
UPDATE public.products SET is_active = true WHERE is_active IS NULL;
UPDATE public.products SET sort_order = 100 WHERE sort_order IS NULL;
UPDATE public.products SET unit_type = 'per_unit' WHERE unit_type IS NULL;

-- Stock: rendilo robusto (null -> 0, poi NOT NULL DEFAULT 0)
UPDATE public.products SET stock = 0 WHERE stock IS NULL;

ALTER TABLE public.products
    ALTER COLUMN stock SET DEFAULT 0;

DO $$
BEGIN
    -- set NOT NULL solo se non lo è già
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='stock' AND is_nullable='YES'
    ) THEN
        ALTER TABLE public.products ALTER COLUMN stock SET NOT NULL;
    END IF;
END $$;

-- Backfill stock_unit coherent with Soluzione A (kg reali / unità)
UPDATE public.products
SET stock_unit =
  CASE
    WHEN unit_type = 'per_kg' THEN 'kg'
    ELSE 'unit'
  END
WHERE stock_unit IS NULL;

-- Backfill stock_unlimited: eventuali record con stock NULL => unlimited
UPDATE public.products
SET stock_unlimited = true,
    stock = 0
WHERE stock IS NULL;

-- Orders: ALL columns (including stock_committed BEFORE functions reference it)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS public_id text,
ADD COLUMN IF NOT EXISTS customer_first_name text,
ADD COLUMN IF NOT EXISTS customer_last_name text,
ADD COLUMN IF NOT EXISTS address jsonb,
ADD COLUMN IF NOT EXISTS reserve_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_committed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS distance_km numeric(10,2);

-- REMOVE stock_scaled (Solution A: NO stock_scaled column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='orders' AND column_name='stock_scaled'
    ) THEN
        ALTER TABLE public.orders DROP COLUMN stock_scaled;
    END IF;
END $$;

-- Categories: additional columns
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Store Settings: additional columns
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS delivery_base_km numeric(10,2) NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS delivery_base_fee numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_extra_fee_per_km numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL
DEFAULT jsonb_build_object(
  'cash', true,
  'pos_on_delivery', true,
  'card_online', true
),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS singleton_key boolean NOT NULL DEFAULT true;

-- Backfill orders (safe on existing rows)
UPDATE public.orders
SET public_id = left(id::text, 12)
WHERE public_id IS NULL;

UPDATE public.orders
SET
    customer_first_name = COALESCE(address->>'firstName', address->>'first_name', ''),
    customer_last_name  = COALESCE(address->>'lastName',  address->>'last_name',  '')
WHERE customer_first_name IS NULL OR customer_last_name IS NULL;

UPDATE public.orders
SET
  subtotal = COALESCE(subtotal, total),
  delivery_fee = COALESCE(delivery_fee, 0),
  distance_km = COALESCE(distance_km, 0)
WHERE subtotal IS NULL
   OR delivery_fee IS NULL
   OR distance_km IS NULL;

-- Backfill store_settings (safe on existing singleton row)
UPDATE public.store_settings
SET
  delivery_base_km = COALESCE(delivery_base_km, 3),
  delivery_base_fee = COALESCE(delivery_base_fee, delivery_fee_base, 0),
  delivery_extra_fee_per_km = COALESCE(delivery_extra_fee_per_km, delivery_fee_per_km, 0),
  payment_methods = COALESCE(
    payment_methods,
    jsonb_build_object(
      'cash', true,
      'pos_on_delivery', true,
      'card_online', true
    )
  );

-- ============================================================
-- ⚙️  FUNCTIONS / RPC
-- ============================================================

-- Helper: admin check (profiles.role = 'admin')
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = uid
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.set_orders_public_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_id IS NULL THEN
        NEW.public_id := left(NEW.id::text, 12);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_orders_public_id ON public.orders;
CREATE TRIGGER trigger_set_orders_public_id
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_orders_public_id();

CREATE OR REPLACE FUNCTION public.sync_customer_names_from_address()
RETURNS TRIGGER AS $$
BEGIN
    NEW.customer_first_name := COALESCE(
        NEW.address->>'firstName',
        NEW.address->>'first_name',
        ''
    );

    NEW.customer_last_name := COALESCE(
        NEW.address->>'lastName',
        NEW.address->>'last_name',
        ''
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_names ON public.orders;
CREATE TRIGGER trigger_sync_customer_names
    BEFORE INSERT OR UPDATE OF address ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_customer_names_from_address();

CREATE OR REPLACE FUNCTION public.set_store_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_store_settings_updated_at();

-- Trigger: se arriva stock NULL, convertilo in unlimited (stock_unlimited=true, stock=0)
CREATE OR REPLACE FUNCTION public.products_apply_stock_unlimited()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock IS NULL THEN
    NEW.stock_unlimited := true;
    NEW.stock := 0;
  END IF;

  IF COALESCE(NEW.stock_unlimited, false) = true THEN
    NEW.stock := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_apply_stock_unlimited ON public.products;
CREATE TRIGGER trg_products_apply_stock_unlimited
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.products_apply_stock_unlimited();

-- ============================================================
-- 📦 CANONICAL STOCK RPC (DB-FIRST, SOLUTION A)
-- ============================================================
-- Official API: reserve_order_stock, release_order_stock, cleanup_expired_reservations
-- All other names are thin alias wrappers that delegate to these.
-- ============================================================

-- CANONICAL: Reserve stock for an entire order (Soluzione A: REAL KG, no scaling)
-- Idempotent: if stock_committed is already true, does nothing
CREATE OR REPLACE FUNCTION public.reserve_order_stock_internal(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_committed boolean;
  v_item RECORD;
  v_product_stock numeric;
  v_product_stock_unlimited boolean;
BEGIN
  -- Idempotency check: if already committed, return early
  SELECT stock_committed INTO v_stock_committed
  FROM public.orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  END IF;
  
  IF v_stock_committed = true THEN
    RETURN; -- Already committed, idempotent
  END IF;
  
  -- Loop through all order_items for this order
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.product_id -- Consistent ordering to avoid deadlocks
  LOOP
    -- Lock product row FOR UPDATE to prevent concurrent modifications
    SELECT stock, COALESCE(stock_unlimited, false)
    INTO v_product_stock, v_product_stock_unlimited
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING errcode = 'P0001';
    END IF;
    
    -- If stock_unlimited is true, skip this product (reservation always succeeds, no decrement)
    IF v_product_stock_unlimited = true THEN
      CONTINUE;
    END IF;
    
    -- Check if stock is sufficient (REAL numeric comparison, no scaling)
    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING errcode = 'P0001';
    END IF;
    
    -- Decrement stock using REAL numeric values (no x10/x100 scaling)
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING errcode = 'P0001';
    END IF;
  END LOOP;
  
  -- All products reserved successfully, mark order as committed
  UPDATE public.orders
  SET stock_committed = true
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  END IF;
END;
$$;

-- CANONICAL: Release stock for an entire order (Soluzione A: REAL KG, no scaling)
-- Idempotent: if stock_committed is already false, does nothing
CREATE OR REPLACE FUNCTION public.release_order_stock_internal(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_committed boolean;
  v_item RECORD;
  v_product_stock_unlimited boolean;
BEGIN
  -- Idempotency check
  SELECT stock_committed INTO v_stock_committed
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  END IF;

  IF v_stock_committed = false THEN
    RETURN; -- Already released, idempotent
  END IF;

  -- Loop items and increment stock back
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.product_id
  LOOP
    -- Lock product row for consistency
    SELECT COALESCE(stock_unlimited, false)
    INTO v_product_stock_unlimited
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    -- If product not found, ignore (safe)
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Unlimited: no-op
    IF v_product_stock_unlimited = true THEN
      CONTINUE;
    END IF;

    -- Increment (Soluzione A: kg/unità reali, no scaling)
    UPDATE public.products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- Mark order as not committed and not reserved
  UPDATE public.orders
  SET
    stock_committed = false,
    stock_reserved = false,
    reserve_expires_at = NULL
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  END IF;
END;
$$;

-- CANONICAL: Cleanup expired reservations (TTL)
-- Releases stock for unpaid card_online orders whose reservation expired.
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_count integer := 0;
BEGIN
  FOR v_order IN
    SELECT id
    FROM public.orders
    WHERE stock_reserved = true
      AND payment_status = 'pending'
      AND reserve_expires_at IS NOT NULL
      AND reserve_expires_at < now()
  LOOP
    -- Release stock (idempotent)
    PERFORM public.release_order_stock_internal(v_order.id);

    -- Mark order as cancelled/expired (safe defaults)
    UPDATE public.orders
    SET
      status = 'cancelled',
      payment_status = 'expired',
      stock_reserved = false,
      reserve_expires_at = NULL,
      stock_committed = false
    WHERE id = v_order.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 📦 OFFICIAL PUBLIC RPC (snake_case, PostgREST compatible)
-- ============================================================
-- Node.js calls these: reserve_order_stock, release_order_stock, cleanup_expired_reservations
-- ============================================================

-- Official RESERVE RPC: calls internal function
CREATE OR REPLACE FUNCTION public.reserve_order_stock(order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.reserve_order_stock_internal($1);
$$;

-- Official RELEASE RPC: calls internal function
CREATE OR REPLACE FUNCTION public.release_order_stock(order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.release_order_stock_internal($1);
$$;

-- cleanup_expired_reservations is already canonical (no wrapper needed)

-- ============================================================
-- 📦 LEGACY ALIASES (backward compatibility)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reserveorderstock(order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.reserve_order_stock($1);
$$;

CREATE OR REPLACE FUNCTION public.releaseorderstock(order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.release_order_stock($1);
$$;

CREATE OR REPLACE FUNCTION public.releaseOrderStock(order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.release_order_stock($1);
$$;

-- ============================================================
-- 📦 STORAGE BUCKETS
-- ============================================================

-- ============================================================
-- 📦  STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'products',
    'products',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 🔐 RLS / POLICIES
-- ============================================================

-- ============================================================
-- 🔐 RLS / POLICIES
-- ============================================================

-- CATEGORIES (public read + admin CRUD; soft delete/restore via UPDATE)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_categories" ON public.categories;
CREATE POLICY "public_select_categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL AND is_active = true);

DROP POLICY IF EXISTS "admin_select_categories" ON public.categories;
CREATE POLICY "admin_select_categories"
ON public.categories
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_insert_categories" ON public.categories;
CREATE POLICY "admin_insert_categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_categories" ON public.categories;
CREATE POLICY "admin_update_categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_delete_categories" ON public.categories;
CREATE POLICY "admin_delete_categories"
ON public.categories
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- STORE SETTINGS (public read; admin update)
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_store_settings" ON public.store_settings;
CREATE POLICY "public_select_store_settings"
ON public.store_settings
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "admin_select_store_settings" ON public.store_settings;
CREATE POLICY "admin_select_store_settings"
ON public.store_settings
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_store_settings" ON public.store_settings;
CREATE POLICY "admin_update_store_settings"
ON public.store_settings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- PRODUCTS (public catalog can read active, non-deleted products; admin CRUD)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_products" ON public.products;
CREATE POLICY "public_select_products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL AND COALESCE(is_active, true) = true);

DROP POLICY IF EXISTS "admin_select_products" ON public.products;
CREATE POLICY "admin_select_products"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_insert_products" ON public.products;
CREATE POLICY "admin_insert_products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_products" ON public.products;
CREATE POLICY "admin_update_products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_delete_products" ON public.products;
CREATE POLICY "admin_delete_products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================================
-- STORAGE: bucket immagini prodotti
-- ============================================================

-- Policy: chiunque può leggere immagini (catalogo pubblico)
DROP POLICY IF EXISTS "public_read_products_images" ON storage.objects;
CREATE POLICY "public_read_products_images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'products');

-- Policy: solo admin può caricare immagini
DROP POLICY IF EXISTS "admin_upload_products_images" ON storage.objects;
CREATE POLICY "admin_upload_products_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
);

-- Policy: solo admin può cancellare immagini
DROP POLICY IF EXISTS "admin_delete_products_images" ON storage.objects;
CREATE POLICY "admin_delete_products_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
);

-- Policy: solo admin può aggiornare immagini (necessario per upsert/overwrite)
DROP POLICY IF EXISTS "admin_update_products_images" ON storage.objects;
CREATE POLICY "admin_update_products_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
);

-- ============================================================
-- 📊 INDEXES & CONSTRAINTS
-- ============================================================

-- ============================================================
-- 📊  INDEXES AND CONSTRAINTS
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_orders_customer_first_name ON public.orders(customer_first_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_last_name ON public.orders(customer_last_name);

CREATE INDEX IF NOT EXISTS idx_orders_reserve_expires_at
ON public.orders(reserve_expires_at)
WHERE reserve_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- Store settings singleton constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_settings_singleton_key_unique'
  ) THEN
    ALTER TABLE public.store_settings
      ADD CONSTRAINT store_settings_singleton_key_unique UNIQUE (singleton_key);
  END IF;
END $$;

INSERT INTO public.store_settings (singleton_key)
VALUES (true)
ON CONFLICT (singleton_key) DO NOTHING;


-- ============================================================
-- 🔓 GRANTS (required for PostgREST access)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public read
GRANT SELECT ON TABLE public.products, public.categories, public.store_settings TO anon;

-- Authenticated read
GRANT SELECT ON TABLE public.products, public.categories, public.store_settings, public.orders, public.order_items, public.profiles TO authenticated;

-- Customer checkout flow
GRANT INSERT ON TABLE public.orders, public.order_items TO authenticated;

-- Admin mutations (RLS will gate actual access)
GRANT INSERT, UPDATE, DELETE ON TABLE public.products, public.categories TO authenticated;
GRANT UPDATE ON TABLE public.store_settings, public.orders TO authenticated;

-- Future objects too (important for one-shot installs)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ============================================================
-- 🔧 RPC GRANTS (official API)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.reserve_order_stock(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_order_stock(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations() TO anon, authenticated, service_role;

-- Legacy aliases grants (for backward compatibility)
GRANT EXECUTE ON FUNCTION public.reserveorderstock(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.releaseorderstock(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.releaseOrderStock(uuid) TO anon, authenticated, service_role;

-- Reload PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 👤 PROFILES PATCHES (AUTH HOOK + RLS)
-- ============================================================

-- PATCH: auto-create profiles row on new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- PATCH: backfill missing profiles for existing auth users
insert into public.profiles (id, role)
select u.id, 'customer'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- PATCH: profiles - allow user to read own profile
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;
end $$;

-- ============================================================
-- 🌱 SLUG PATCHES + DEMO SEED
-- ============================================================

-- PATCH: categories.slug for stable URLs + idempotent seeds
alter table public.categories
add column if not exists slug text;

-- Backfill slug from name (only when missing)
update public.categories
set slug = lower(regexp_replace(trim(name), '\s+', '-', 'g'))
where slug is null;

-- Enforce slug not null (safe)
alter table public.categories
alter column slug set not null;

-- Unique index for ON CONFLICT (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='categories'
      and indexname='categories_slug_unique'
  ) then
    create unique index categories_slug_unique on public.categories(slug);
  end if;
end $$;


-- OPTIONAL: DEMO SEED - categories
insert into public.categories (name, slug, is_active, sort_order)
values
  ('Frutta e Verdura', 'frutta-verdura', true, 1),
  ('Dispensa', 'dispensa', true, 2),
  ('Bevande', 'bevande', true, 3)
on conflict (slug) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;


-- PATCH: categories.slug for stable URLs + idempotent seeds
alter table public.categories
add column if not exists slug text;

update public.categories
set slug = lower(regexp_replace(trim(name), '\s+', '-', 'g'))
where slug is null;

alter table public.categories
alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='categories'
      and indexname='categories_slug_unique'
  ) then
    create unique index categories_slug_unique on public.categories(slug);
  end if;
end $$;

-- OPTIONAL: DEMO SEED - categories
insert into public.categories (name, slug, is_active, sort_order)
values
  ('Frutta e Verdura', 'frutta-verdura', true, 1),
  ('Dispensa', 'dispensa', true, 2),
  ('Bevande', 'bevande', true, 3)
on conflict (slug) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- PATCH: products.slug for stable URLs + idempotent seeds
alter table public.products
add column if not exists slug text;

-- Backfill slug from name (only when missing)
update public.products
set slug = lower(regexp_replace(trim(name), '\s+', '-', 'g'))
where slug is null;

alter table public.products
alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='products'
      and indexname='products_slug_unique'
  ) then
    create unique index products_slug_unique on public.products(slug);
  end if;
end $$;

-- OPTIONAL: DEMO SEED - categories
insert into public.categories (name, slug, is_active, sort_order)
values
  ('Frutta e Verdura', 'frutta-verdura', true, 1),
  ('Dispensa', 'dispensa', true, 2),
  ('Bevande', 'bevande', true, 3)
on conflict (slug) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- OPTIONAL: DEMO SEED - products (with stable images)
insert into public.products (
  name, slug, description,
  price, price_sale,
  category_id,
  stock, stock_unlimited,
  unit_type, stock_unit,
  is_active, sort_order,
  image_url, image, images
)
select
  v.name,
  v.slug,
  v.description,
  v.price,
  v.price_sale,
  c.id as category_id,
  v.stock,
  v.stock_unlimited,
  v.unit_type,
  v.stock_unit,
  true as is_active,
  v.sort_order,
  v.image_url,
  null::text as image,
  jsonb_build_array(v.image_url) as images
from (values
  -- per_kg
  (
    'Banane',
    'banane',
    'Banane fresche',
    1.99::numeric,
    null::numeric,
    'frutta-verdura',
    20.0::numeric,
    false,
    'per_kg',
    'kg',
    1,
    'https://images.unsplash.com/photo-1640958900081-7b069dd23e9c?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Pomodori',
    'pomodori',
    'Pomodori da insalata',
    2.49::numeric,
    1.99::numeric,
    'frutta-verdura',
    15.0::numeric,
    false,
    'per_kg',
    'kg',
    2,
    'https://images.unsplash.com/photo-1652084610276-c311441bd4ec?auto=format&fit=crop&w=800&q=80'
  ),

  -- per_unit
  (
    'Pasta 500g',
    'pasta-500g',
    'Pasta di grano duro',
    0.99::numeric,
    null::numeric,
    'dispensa',
    50.0::numeric,
    false,
    'per_unit',
    'pz',
    3,
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Passata di pomodoro',
    'passata-pomodoro',
    'Passata 700g',
    1.29::numeric,
    null::numeric,
    'dispensa',
    40.0::numeric,
    false,
    'per_unit',
    'pz',
    4,
    'https://images.unsplash.com/photo-1529566260205-50597c058463?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Acqua 1.5L',
    'acqua-15l',
    'Acqua naturale',
    0.39::numeric,
    null::numeric,
    'bevande',
    100.0::numeric,
    false,
    'per_unit',
    'pz',
    5,
    'https://images.unsplash.com/photo-1561041695-d2fadf9f318c?auto=format&fit=crop&w=800&q=80
'
  ),
  (
    'Coca Cola 1.5L',
    'coca-15l',
    'Bibita gassata',
    1.79::numeric,
    1.49::numeric,
    'bevande',
    30.0::numeric,
    false,
    'per_unit',
    'pz',
    6,
    'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?auto=format&fit=crop&w=800&q=80'
  )
) as v(
  name, slug, description,
  price, price_sale,
  cat_slug,
  stock, stock_unlimited,
  unit_type, stock_unit,
  sort_order, image_url
)
join public.categories c on c.slug = v.cat_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  price_sale = excluded.price_sale,
  category_id = excluded.category_id,
  stock = excluded.stock,
  stock_unlimited = excluded.stock_unlimited,
  unit_type = excluded.unit_type,
  stock_unit = excluded.stock_unit,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  image_url = excluded.image_url,
  images = excluded.images;

-- PATCH: store_settings contatti negozio (footer pubblico)
alter table public.store_settings
  add column if not exists store_name text,
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists opening_hours text,
  add column if not exists maps_link text;

-- PATCH: store_settings flag to enable demo seed
alter table public.store_settings
add column if not exists seed_demo_enabled boolean not null default false;

-- OPTIONAL DEMO SEED (runs only when seed_demo_enabled = true)
do $$
begin
  if exists (select 1 from public.store_settings where seed_demo_enabled = true) then

    -- categories seed (ONE copy)
    insert into public.categories (name, slug, is_active, sort_order)
    values
      ('Frutta e Verdura', 'frutta-verdura', true, 1),
      ('Dispensa', 'dispensa', true, 2),
      ('Bevande', 'bevande', true, 3)
    on conflict (slug) do update set
      name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

    -- products seed (your existing block)
    -- ... incolla qui il tuo insert products ...
  end if;
end $$;

-- ============================================================
-- PATCH: auto-generate slug for categories/products if missing
-- ============================================================

-- 1) slugify helper (SQL, stabile e semplice)
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(coalesce(input, '')),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

-- 2) ensure slug columns are NOT NULL (se già lo sono, ok)
alter table public.categories alter column slug set not null;
alter table public.products   alter column slug set not null;

-- 3) trigger function for categories
create or replace function public.categories_set_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  i int := 0;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base_slug := public.slugify(new.name);
    if base_slug is null or base_slug = '' then
      base_slug := 'category';
    end if;

    candidate := base_slug;

    -- ensure uniqueness (simple -1, -2, ...)
    while exists (
      select 1 from public.categories c
      where c.slug = candidate
        and (tg_op = 'INSERT' or c.id <> new.id)
    ) loop
      i := i + 1;
      candidate := base_slug || '-' || i::text;
    end loop;

    new.slug := candidate;
  end if;

  return new;
end $$;

drop trigger if exists trg_categories_set_slug on public.categories;
create trigger trg_categories_set_slug
before insert or update of name, slug
on public.categories
for each row
execute function public.categories_set_slug();

-- 4) trigger function for products
create or replace function public.products_set_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  i int := 0;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base_slug := public.slugify(new.name);
    if base_slug is null or base_slug = '' then
      base_slug := 'product';
    end if;

    candidate := base_slug;

    while exists (
      select 1 from public.products p
      where p.slug = candidate
        and (tg_op = 'INSERT' or p.id <> new.id)
    ) loop
      i := i + 1;
      candidate := base_slug || '-' || i::text;
    end loop;

    new.slug := candidate;
  end if;

  return new;
end $$;

drop trigger if exists trg_products_set_slug on public.products;
create trigger trg_products_set_slug
before insert or update of name, slug
on public.products
for each row
execute function public.products_set_slug();

-- ============================================================
-- ✅ SETUP COMPLETE
-- ============================================================


