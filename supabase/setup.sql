-- ============================================================
-- 🗄️  SUPERMARKET PWA TEMPLATE - PRODUCTION SETUP
-- One-shot idempotent database setup script
-- ============================================================
-- ============================================================
-- SUPERMARKET PWA TEMPLATE
-- Database installer
-- Version: 1.0
-- Compatible with Supabase (Postgres)
-- ============================================================

-- ============================================================
-- 🧩 EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 📦 TABLES (BASE)
-- ============================================================

-- Product categories
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    deleted_at timestamptz
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    image text,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- Orders
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

-- Store settings
CREATE TABLE IF NOT EXISTS public.store_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name text DEFAULT 'Supermarket Template',
    delivery_enabled boolean DEFAULT true,
    delivery_fee_base numeric(10,2) DEFAULT 0,
    delivery_fee_per_km numeric(10,2) DEFAULT 0.5,
    delivery_max_km numeric(10,2),
    free_over numeric(10,2) DEFAULT 50,
    store_lat numeric(10,6),
    store_lng numeric(10,6)
);

-- User profiles (linked to Supabase Auth)
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

    -- stock (IMPORTANT: NOT NULL + DEFAULT 0 to avoid false "insufficient_stock")
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

-- Backfill products: null values -> default consistent
UPDATE public.products SET is_active = true WHERE is_active IS NULL;
UPDATE public.products SET sort_order = 100 WHERE sort_order IS NULL;
UPDATE public.products SET unit_type = 'per_unit' WHERE unit_type IS NULL;

-- Stock: make it robust (null -> 0, then NOT NULL DEFAULT 0)
UPDATE public.products SET stock = 0 WHERE stock IS NULL;

ALTER TABLE public.products
    ALTER COLUMN stock SET DEFAULT 0;

DO $$
BEGIN
    -- set NOT NULL only if not already set
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='stock' AND is_nullable='YES'
    ) THEN
        ALTER TABLE public.products ALTER COLUMN stock SET NOT NULL;
    END IF;
END $$;

-- Backfill stock_unit coherent with Solution A (real kg / unit)
UPDATE public.products
SET stock_unit =
  CASE
    WHEN unit_type = 'per_kg' THEN 'kg'
    ELSE 'unit'
  END
WHERE stock_unit IS NULL;

-- Backfill stock_unlimited: any record with stock NULL => unlimited
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
ADD COLUMN IF NOT EXISTS delivery_base_km numeric(10,2),
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
alter table public.store_settings
add column if not exists closed_message text;


-- Make delivery km fields nullable with no defaults (template-friendly)
ALTER TABLE public.store_settings
  ALTER COLUMN delivery_base_km DROP DEFAULT,
  ALTER COLUMN delivery_base_km DROP NOT NULL,
  ALTER COLUMN delivery_max_km DROP DEFAULT,
  ALTER COLUMN delivery_max_km DROP NOT NULL;

-- Store settings: opening hours, cutoff, closures, timezone (idempotent)
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS weekly_hours jsonb,
ADD COLUMN IF NOT EXISTS cutoff_time text,
ADD COLUMN IF NOT EXISTS closed_dates jsonb,
ADD COLUMN IF NOT EXISTS closed_ranges jsonb,
ADD COLUMN IF NOT EXISTS accept_orders_when_closed boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome',
ADD COLUMN IF NOT EXISTS preparation_days integer NOT NULL DEFAULT 0;

UPDATE public.store_settings
SET
  cutoff_time = COALESCE(cutoff_time, '19:00'),
  accept_orders_when_closed = COALESCE(accept_orders_when_closed, true),
  timezone = COALESCE(timezone, 'Europe/Rome'),
  preparation_days = COALESCE(preparation_days, 0),
  closed_dates = COALESCE(closed_dates, '[]'::jsonb),
  closed_ranges = COALESCE(closed_ranges, '[]'::jsonb),
  weekly_hours = COALESCE(weekly_hours, '{"mon":[{"start":"09:00","end":"19:30"}],"tue":[{"start":"09:00","end":"19:30"}],"wed":[{"start":"09:00","end":"19:30"}],"thu":[{"start":"09:00","end":"19:30"}],"fri":[{"start":"09:00","end":"19:30"}],"sat":[{"start":"09:00","end":"13:00"}],"sun":[]}'::jsonb)
WHERE id IS NOT NULL;

-- Orders: fulfillment date (first usable day)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_date date;

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

-- Trigger: if stock NULL, convert it to unlimited (stock_unlimited=true, stock=0)
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

-- CANONICAL: Reserve stock for an entire order (Solution A: REAL KG, no scaling)
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
WHERE id = v_item.product_id
  AND stock >= v_item.quantity;
    
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

-- CANONICAL: Release stock for an entire order (Solution A: REAL KG, no scaling)
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

    -- Increment (Solution A: real kg/unit, no scaling)
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
-- STORAGE: products images bucket
-- ============================================================

-- Policy: anyone can read images (public catalog)
DROP POLICY IF EXISTS "public_read_products_images" ON storage.objects;
CREATE POLICY "public_read_products_images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'products');

-- Policy: only admin can upload images
DROP POLICY IF EXISTS "admin_upload_products_images" ON storage.objects;
CREATE POLICY "admin_upload_products_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
);

-- Policy: only admin can delete images
DROP POLICY IF EXISTS "admin_delete_products_images" ON storage.objects;
CREATE POLICY "admin_delete_products_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_admin(auth.uid())
);

-- Policy: only admin can update images (necessary for upsert/overwrite)
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
  ('Fresh Produce', 'fresh-produce', true, 1),
  ('Pantry', 'pantry', true, 2),
  ('Beverages', 'beverages', true, 3)
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

-- =====================================================
-- OPTIONAL DEMO PRODUCTS
-- These sample products are provided for demonstration.
-- They can be safely modified or removed.
-- =====================================================
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
    'Bananas',
    'bananas',
    'Fresh bananas',
    1.99::numeric,
    null::numeric,
    'fresh-produce',
    20.0::numeric,
    false,
    'per_kg',
    'kg',
    1,
    'https://images.unsplash.com/photo-1640958900081-7b069dd23e9c?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Tomatoes',
    'tomatoes',
    'Tomatoes for salad',
    2.49::numeric,
    1.99::numeric,
    'fresh-produce',
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
    'Durum wheat pasta',
    0.99::numeric,
    null::numeric,
    'pantry',
    50.0::numeric,
    false,
    'per_unit',
    'pz',
    3,
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Tomato puree',
    'tomato-puree',
    'Tomato puree 700g',
    1.29::numeric,
    null::numeric,
    'pantry',
    40.0::numeric,
    false,
    'per_unit',
    'pz',
    4,
    'https://images.unsplash.com/photo-1529566260205-50597c058463?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'Water 1.5L',
    'water-15l',
    'Natural mineral water',
    0.39::numeric,
    null::numeric,
    'beverages',
    100.0::numeric,
    false,
    'per_unit',
    'pz',
    5,
    'https://images.unsplash.com/photo-1561041695-d2fadf9f318c?auto=format&fit=crop&w=800&q=80
'
  ),
  (
    'Coca-Cola 1.5L',
    'coca-cola15l',
    'Sparkling soft drink',
    1.79::numeric,
    1.49::numeric,
    'beverages',
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

-- PATCH: store_settings store contact (footer public)
alter table public.store_settings
  add column if not exists store_name text,
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists opening_hours text,
  add column if not exists maps_link text;

  -- Ensure store_settings singleton row exists (based on singleton_key)
insert into public.store_settings (singleton_key)
values (true)
on conflict (singleton_key) do nothing;

-- PATCH: store_settings flag to enable demo seed
alter table public.store_settings
add column if not exists seed_demo_enabled boolean not null default false;

-- OPTIONAL DEMO SEED (runs only when seed_demo_enabled = true)
do $$
begin
  if exists (select 1 from public.store_settings where seed_demo_enabled = true) then

    -- OPTIONAL DEMO CATEGORIES
    -- Example grocery categories (can be modified or removed)
    insert into public.categories (name, slug, is_active, sort_order)
    values
      ('Fresh Produce', 'fresh-produce', true, 1),
      ('Pantry', 'pantry', true, 2),
      ('Beverages', 'beverages', true, 3)
    on conflict (slug) do update set
      name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

    -- products seed (your existing block)
    -- ... paste your insert products here ...
  end if;
end $$;

-- ============================================================
-- PATCH: auto-generate slug for categories/products if missing
-- ============================================================

-- 1) slugify helper (SQL, stable and simple)
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

-- =====================================================
-- PRODUCTS: archived flag
-- =====================================================
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- =====================================================
-- ORDER_ITEMS: block archived products (DB-first)
-- =====================================================
create or replace function public.tg_block_archived_products_on_order_items()
returns trigger
language plpgsql
as $$
declare
  v_archived boolean;
begin
  select p.archived
    into v_archived
  from public.products p
  where p.id = new.product_id;

  if v_archived is null then
    return new;
  end if;

  if v_archived = true then
    raise exception 'PRODUCT_UNAVAILABLE: product % is archived', new.product_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_block_archived_products_order_items'
  ) then
    create trigger trg_block_archived_products_order_items
    before insert or update of product_id
    on public.order_items
    for each row
    execute function public.tg_block_archived_products_on_order_items();
  end if;
end $$;

-- ============================================================
-- STOCK BASELINE SUPPORT (production-grade, idempotent)
-- ============================================================

-- 1) Column baseline
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_baseline numeric;

COMMENT ON COLUMN public.products.stock_baseline
IS 'Stock massimo/baseline impostato (o raggiunto su restock). Usato per calcolare percentuale UI.';


-- 2) Backfill baseline only if stock > 0
UPDATE public.products
SET stock_baseline = stock
WHERE COALESCE(stock_unlimited, false) = false
  AND stock_baseline IS NULL
  AND stock IS NOT NULL
  AND stock > 0;


-- 3) Clean up existing incorrect data (baseline=0)
UPDATE public.products
SET stock_baseline = NULL
WHERE COALESCE(stock_unlimited,false)=false
  AND stock_baseline = 0;


-- 4) Trigger function robust
CREATE OR REPLACE FUNCTION public.tg_products_stock_baseline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN

  -- Unlimited products → baseline NULL
  IF COALESCE(NEW.stock_unlimited, false) = true THEN
    NEW.stock_baseline := NULL;
    RETURN NEW;
  END IF;


  -- Initialize baseline
  IF NEW.stock_baseline IS NULL THEN

    IF NEW.stock IS NOT NULL AND NEW.stock > 0 THEN
      NEW.stock_baseline := NEW.stock;
    ELSE
      NEW.stock_baseline := NULL;
    END IF;

    RETURN NEW;

  END IF;


  -- Restock → update baseline
  IF NEW.stock IS NOT NULL
     AND NEW.stock > NEW.stock_baseline THEN

     NEW.stock_baseline := NEW.stock;

  END IF;


  RETURN NEW;

END;
$$;


-- 5) Trigger idempotent
DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_products_stock_baseline'
  )
  THEN

    CREATE TRIGGER trg_products_stock_baseline

    BEFORE INSERT OR UPDATE OF stock, stock_unlimited, stock_baseline

    ON public.products

    FOR EACH ROW

    EXECUTE FUNCTION public.tg_products_stock_baseline();

  END IF;

END $$;

-- ============================================================
-- PATCH 2026-02-19 — get_fulfillment_preview multi-slot same-day
-- Fix: between two slots in the same day => fulfillment today
-- ============================================================

 CREATE OR REPLACE FUNCTION public.get_fulfillment_preview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  tz text;
  now_local timestamp;
  d date;
  t time;
  dow int;
  day_key text;
  cutoff_t time;
  is_open_today boolean := false;
  after_cutoff boolean := false;
  can_accept boolean := true;
  start_date date;
  next_date date;
  prep_days int;
  slots jsonb;
  slot jsonb;
  slot_start time;
  slot_end time;
  day_max_end time;
  next_slot_start time;          -- NEW: next slot today
  has_future_slot_today boolean := false;  -- NEW
  i int;
  j int;
  msg text;
  in_range boolean;
  msg_code text := null;
  current_day_key text;
  day_keys text[] := ARRAY['sun','mon','tue','wed','thu','fri','sat'];
BEGIN
  SELECT
    COALESCE(timezone, 'Europe/Rome') AS timezone,
    COALESCE(cutoff_time, '19:00') AS cutoff_time,
    COALESCE(weekly_hours, '{"mon":[{"start":"09:00","end":"19:30"}],"tue":[{"start":"09:00","end":"19:30"}],"wed":[{"start":"09:00","end":"19:30"}],"thu":[{"start":"09:00","end":"19:30"}],"fri":[{"start":"09:00","end":"19:30"}],"sat":[{"start":"09:00","end":"13:00"}],"sun":[]}'::jsonb) AS weekly_hours,
    COALESCE(closed_dates, '[]'::jsonb) AS closed_dates,
    COALESCE(closed_ranges, '[]'::jsonb) AS closed_ranges,
    COALESCE(accept_orders_when_closed, true) AS accept_orders_when_closed,
    COALESCE(preparation_days, 0) AS preparation_days
  INTO s
  FROM public.store_settings
  LIMIT 1;

 IF NOT FOUND THEN
  msg_code := 'delivery_today';
  RETURN jsonb_build_object(
    'ok', true,
    'can_accept', true,
    'is_open_now', true,
    'after_cutoff', false,
    'next_fulfillment_date', to_char(now()::date, 'YYYY-MM-DD'),
    'message_code', COALESCE(msg_code, ''),
    'message', ''
  );

  END IF;

  tz := s.timezone;
  now_local := (now() AT TIME ZONE tz);
  d := now_local::date;
  t := now_local::time;
  dow := EXTRACT(DOW FROM now_local)::int;
  day_key := day_keys[dow + 1];

  BEGIN
    cutoff_t := (trim(s.cutoff_time))::time;
  EXCEPTION WHEN OTHERS THEN
    cutoff_t := '19:00'::time;
  END;

  -- 1) check closures (date / ranges)
  IF jsonb_typeof(s.closed_dates) = 'array'
     AND to_char(d, 'YYYY-MM-DD') = ANY(ARRAY(SELECT jsonb_array_elements_text(s.closed_dates))) THEN
    is_open_today := false;
  ELSIF jsonb_typeof(s.closed_ranges) = 'array' THEN
    in_range := false;
    FOR i IN 0 .. jsonb_array_length(s.closed_ranges) - 1 LOOP
      IF (s.closed_ranges->i->>'from')::date <= d
         AND d <= (s.closed_ranges->i->>'to')::date THEN
        in_range := true;
        EXIT;
      END IF;
    END LOOP;
    is_open_today := NOT in_range;
  ELSE
    is_open_today := true;
  END IF;

  -- 2) evaluate today's slots (and find the next future slot)
  IF is_open_today THEN
    slots := s.weekly_hours->day_key;
    IF slots IS NOT NULL AND jsonb_typeof(slots) = 'array' AND jsonb_array_length(slots) > 0 THEN
      is_open_today := false;
      day_max_end := NULL;
      next_slot_start := NULL;
      has_future_slot_today := false;

      FOR j IN 0 .. jsonb_array_length(slots) - 1 LOOP
        slot := slots->j;
        BEGIN
          slot_start := (slot->>'start')::time;
          slot_end := (slot->>'end')::time;

          -- max end of the day
          IF day_max_end IS NULL OR slot_end > day_max_end THEN
            day_max_end := slot_end;
          END IF;

          -- open now?
          IF t >= slot_start AND t < slot_end THEN
            is_open_today := true;
          END IF;

          -- NEW: next slot today (if start > now)
          IF slot_start > t THEN
            has_future_slot_today := true;
            IF next_slot_start IS NULL OR slot_start < next_slot_start THEN
              next_slot_start := slot_start;
            END IF;
          END IF;

        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;

    ELSE
      is_open_today := false;
    END IF;
  END IF;

  -- 3) extend cutoff until the end of the last slot (avoid false "closed" with multi-slot)
  IF day_max_end IS NOT NULL AND day_max_end > cutoff_t THEN
    cutoff_t := day_max_end;
  END IF;

  after_cutoff := (t >= cutoff_t);

  -- 4) if closed and does not accept orders when closed → block
  IF NOT is_open_today AND NOT s.accept_orders_when_closed THEN
  msg_code := 'store_closed_not_accepting_orders';
  RETURN jsonb_build_object(
    'ok', true,
    'can_accept', false,
    'is_open_now', false,
    'after_cutoff', after_cutoff,
    'next_fulfillment_date', NULL,
    'message_code', COALESCE(msg_code, ''),
    'message', 'Negozio chiuso. Ordini non accettati in questo momento.'
  );
END IF;

  prep_days := s.preparation_days;

  -- 5) calculate fulfillment date (NEW: if there is a future slot today, stay today)
IF is_open_today OR has_future_slot_today THEN
  start_date := d + prep_days;
ELSIF after_cutoff THEN
  start_date := d + 1 + prep_days;
ELSE
  start_date := d + 1 + prep_days;
END IF;

  -- find the first usable day (keep existing logic)
  FOR i IN 1 .. 30 LOOP
    current_day_key := day_keys[EXTRACT(DOW FROM start_date)::int + 1];
    IF NOT (
      (jsonb_typeof(s.closed_dates) = 'array' AND to_char(start_date, 'YYYY-MM-DD') = ANY(ARRAY(SELECT jsonb_array_elements_text(s.closed_dates))))
      OR (jsonb_typeof(s.closed_ranges) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.closed_ranges) AS r(e)
        WHERE (e->>'from')::date <= start_date AND start_date <= (e->>'to')::date
      ))
      OR (s.weekly_hours->current_day_key IS NULL OR jsonb_array_length(COALESCE(s.weekly_hours->current_day_key, '[]'::jsonb)) = 0)
    ) THEN
      EXIT;
    END IF;
    start_date := start_date + 1;
  END LOOP;

  next_date := start_date;

  -- 6) final message
IF has_future_slot_today AND next_date = d THEN
  msg_code := 'store_reopens_later_today';
  IF next_slot_start IS NOT NULL THEN
    msg := 'Negozio chiuso. Il tuo ordine verrà evaso oggi (dalle ' || to_char(next_slot_start, 'HH24:MI') || ').';
  ELSE
    msg := 'Negozio chiuso. Il tuo ordine verrà evaso oggi.';
  END IF;
ELSIF NOT is_open_today THEN
  msg_code := 'store_closed_next_date';
  msg := 'Negozio chiuso. Il tuo ordine sarà evaso il ' || to_char(next_date, 'DD/MM/YYYY') || '.';
ELSIF after_cutoff THEN
  msg_code := 'after_cutoff_next_date';
  msg := 'Orario limite superato. Il tuo ordine sarà evaso il ' || to_char(next_date, 'DD/MM/YYYY') || '.';
ELSE
  msg_code := 'delivery_today';
  msg := '';
END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'can_accept', true,
    'is_open_now', is_open_today,
    'after_cutoff', after_cutoff,
    'next_fulfillment_date', to_char(next_date, 'YYYY-MM-DD'),
    'message_code', COALESCE(msg_code, ''),
    'message', COALESCE(msg, '')
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_fulfillment_preview() TO anon, authenticated, service_role;
 
 -- ============================================================
-- DELIVERY GUARD
-- Block order creation if delivery is disabled
-- ============================================================
create or replace function public.guard_orders_delivery_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enabled boolean;
begin
  select delivery_enabled
  into enabled
  from public.store_settings
  limit 1;

  -- If NULL, treat it as true (do not block) or false.
  -- Here we treat it as true to not break incomplete setup.
  if enabled is false then
    raise exception 'DELIVERY_DISABLED: Le consegne sono temporaneamente disabilitate'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_orders_delivery_enabled on public.orders;

create trigger trg_guard_orders_delivery_enabled
before insert on public.orders
for each row
execute function public.guard_orders_delivery_enabled();

-- ============================================================
-- SAFE DEFAULT: delivery disabled only if not configured
-- avoid accidental checkout after initial installation
-- do not overwrite valid configurations
-- ============================================================

update public.store_settings
set
  delivery_enabled = false,
  updated_at = now()
where
  delivery_enabled = true
  and (
    delivery_base_km is null
    or delivery_max_km is null
  );
-- =====================================================
-- PRODUCTS: qty_step
-- Must exist before functions/triggers that use it
-- =====================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS qty_step numeric(10,3);

COMMENT ON COLUMN public.products.qty_step
IS 'Minimum purchase increment for product purchase (e.g. 1 for unit, 0.1 / 0.5 / 1 for kg).';

-- Backfill: do not overwrite custom values already existing
UPDATE public.products
SET qty_step =
  CASE
    WHEN unit_type = 'per_kg' THEN 0.1
    ELSE 1
  END
WHERE qty_step IS NULL;

-- =====================================================
-- PATCH: products.qty_step default + trigger behavior (production-safe)
-- =====================================================

-- Default consistent: leave NULL and let the trigger decide based on unit_type.
ALTER TABLE public.products
  ALTER COLUMN qty_step DROP DEFAULT;

-- Trigger function: per_unit => 1, per_kg => keep valid, else 0.1
CREATE OR REPLACE FUNCTION public.tg_products_set_qty_step()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  step_num numeric(10,3);
BEGIN
  -- per_unit (or null) => always 1
  IF NEW.unit_type IS DISTINCT FROM 'per_kg' THEN
    NEW.qty_step := 1;
    RETURN NEW;
  END IF;

  -- per_kg: if admin sent a valid step (>0), do not touch
  IF NEW.qty_step IS NOT NULL THEN
    step_num := NEW.qty_step::numeric(10,3);
    IF step_num > 0 THEN
      NEW.qty_step := step_num;
      RETURN NEW;
    END IF;
  END IF;

  -- per_kg: missing or invalid step => 0.1
  NEW.qty_step := 0.1;
  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_products_set_qty_step ON public.products;

CREATE TRIGGER trg_products_set_qty_step
BEFORE INSERT OR UPDATE OF unit_type, qty_step
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.tg_products_set_qty_step();
-- =====================================================
-- REALTIME: enable products updates + full row payload
-- =====================================================

-- 1) Ensure products is in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

-- 2) For UPDATE events, send full row (not only changed columns)
ALTER TABLE public.products REPLICA IDENTITY FULL;


-- =====================================================
-- ORDERS: customer_phone (idempotent / SAFE ALTER)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'customer_phone'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN customer_phone text;
  END IF;
END $$;

COMMENT ON COLUMN public.orders.customer_phone
IS 'Customer phone number for delivery contact. Stored as free text (e.g. +39 333 1234567).';
-- ============================================================
-- STORE SETTINGS - SOCIAL LINKS SUPPORT
-- Adds JSONB column to store social media links used in the footer
-- ============================================================
alter table public.store_settings
  add column if not exists social_links jsonb not null default '{}'::jsonb;

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

-- Reload PostgREST schema cache (Supabase Realtime)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ✅ SETUP COMPLETE
-- ============================================================