-- ============================================================
-- 🗄️  SUPERMARKET PWA TEMPLATE - PRODUCTION SETUP
-- One-shot idempotent database setup script
-- ============================================================

-- Estensioni utili (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 📦  BASE TABLES
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
-- 🔧  ADD COLUMNS TO EXISTING TABLES
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

-- Orders: additional columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS stock_scaled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS public_id text,
ADD COLUMN IF NOT EXISTS customer_first_name text,
ADD COLUMN IF NOT EXISTS customer_last_name text,
ADD COLUMN IF NOT EXISTS address jsonb,
ADD COLUMN IF NOT EXISTS reserve_expires_at timestamptz;

-- Stock reservation flag
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;

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

-- ============================================================
-- 🔄  BACKFILL DATA
-- ============================================================

UPDATE public.orders
SET public_id = left(id::text, 12)
WHERE public_id IS NULL;

UPDATE public.orders
SET
    customer_first_name = COALESCE(address->>'firstName', address->>'first_name', ''),
    customer_last_name  = COALESCE(address->>'lastName',  address->>'last_name',  '')
WHERE customer_first_name IS NULL OR customer_last_name IS NULL;

-- ============================================================
-- ⚙️  FUNCTIONS AND TRIGGERS
-- ============================================================

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
-- 📦 STOCK RESERVATION RPC (ATOMIC, DIAGNOSTIC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_decrement_stock(
  p_product_id uuid,
  p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock numeric;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY';
  END IF;

  SELECT stock INTO v_stock
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_stock < p_qty THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE public.products
  SET stock = stock - p_qty
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_decrement_stock_v2(
  p_product_id uuid,
  p_qty numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  new_stock numeric;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY';
  END IF;

  UPDATE public.products
  SET stock = stock - p_qty
  WHERE id = p_product_id
    AND stock >= p_qty
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_decrement_stock_debug(
  p_product_id uuid,
  p_qty numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  old_stock numeric;
  new_stock numeric;
  updated boolean;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY';
  END IF;

  SELECT stock INTO old_stock
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'old_stock', NULL,
      'new_stock', NULL,
      'updated', false
    );
  END IF;

  UPDATE public.products
  SET stock = stock - p_qty
  WHERE id = p_product_id
    AND stock >= p_qty
  RETURNING stock INTO new_stock;

  updated := (new_stock IS NOT NULL);

  RETURN jsonb_build_object(
    'old_stock', old_stock,
    'new_stock', new_stock,
    'updated', updated
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.rpc_increment_stock(
  p_product_id uuid,
  p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY';
  END IF;

  UPDATE public.products
  SET stock = stock + p_qty
  WHERE id = p_product_id;
END;
$$;

-- Reload PostgREST schema cache (evita "schema cache" dopo setup)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ✅  SETUP COMPLETE
-- ============================================================
-- ============================================================
-- ============================================================
-- ============================================================
-- 🧩 SAFE ALTER / RLS PATCHES (schema drift protection)
-- Keep setup.sql compatible with code expectations
-- ============================================================

-- ============================================================
-- 👤 Helper: admin check (profiles.role = 'admin')
-- ============================================================
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and role = 'admin'
  );
$$;

-- ============================================================
-- ORDERS (admin/orders API expects these columns)
-- ============================================================

alter table public.orders
add column if not exists public_id text;

alter table public.orders
add column if not exists customer_first_name text;

alter table public.orders
add column if not exists customer_last_name text;

alter table public.orders
add column if not exists address text;

alter table public.orders
add column if not exists stock_reserved boolean not null default false;

alter table public.orders
add column if not exists reserve_expires_at timestamptz;

alter table public.orders
add column if not exists stock_committed boolean not null default false;

alter table public.orders
add column if not exists subtotal numeric(10,2);

alter table public.orders
add column if not exists delivery_fee numeric(10,2) not null default 0;

alter table public.orders
add column if not exists distance_km numeric(10,2);

-- Backfill (safe on existing rows)
update public.orders
set
  subtotal = coalesce(subtotal, total),
  delivery_fee = coalesce(delivery_fee, 0),
  distance_km = coalesce(distance_km, 0)
where subtotal is null
   or delivery_fee is null
   or distance_km is null;

-- ============================================================
-- PRODUCTS (admin/products expects these columns)
-- ============================================================

alter table public.products
add column if not exists unit_type text;

alter table public.products
add column if not exists stock numeric(10,2);

alter table public.products
add column if not exists stock_unit text;

alter table public.products
add column if not exists is_active boolean;

-- Backfill coherent with Soluzione A (kg reali / unità)
update public.products
set stock_unit =
  case
    when unit_type = 'per_kg' then 'kg'
    else 'unit'
  end
where stock_unit is null;

-- ============================================================
-- STORE SETTINGS (admin/settings/delivery expects these columns)
-- ============================================================

alter table public.store_settings
add column if not exists delivery_base_km numeric(10,2) not null default 3;

alter table public.store_settings
add column if not exists delivery_base_fee numeric(10,2) not null default 0;

alter table public.store_settings
add column if not exists delivery_extra_fee_per_km numeric(10,2) not null default 0;

alter table public.store_settings
add column if not exists payment_methods jsonb not null
default jsonb_build_object(
  'cash', true,
  'pos_on_delivery', true,
  'card_online', true
);

-- Backfill (safe on existing singleton row)
update public.store_settings
set
  delivery_base_km = coalesce(delivery_base_km, 3),
  delivery_base_fee = coalesce(delivery_base_fee, delivery_fee_base, 0),
  delivery_extra_fee_per_km = coalesce(delivery_extra_fee_per_km, delivery_fee_per_km, 0),
  payment_methods = coalesce(
    payment_methods,
    jsonb_build_object(
      'cash', true,
      'pos_on_delivery', true,
      'card_online', true
    )
  );

-- ============================================================
-- STORE SETTINGS: updated_at (required by admin UI updates)
-- ============================================================

alter table public.store_settings
add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_store_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_settings_updated_at on public.store_settings;
create trigger trg_store_settings_updated_at
before update on public.store_settings
for each row
execute function public.set_store_settings_updated_at();

-- ============================================================
-- 🔐 RLS / POLICIES
-- ============================================================

-- CATEGORIES (public read + admin CRUD; soft delete/restore via UPDATE)
alter table public.categories enable row level security;

drop policy if exists "public_select_categories" on public.categories;
create policy "public_select_categories"
on public.categories
for select
to anon
using (deleted_at is null);

drop policy if exists "admin_select_categories" on public.categories;
create policy "admin_select_categories"
on public.categories
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "admin_insert_categories" on public.categories;
create policy "admin_insert_categories"
on public.categories
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "admin_update_categories" on public.categories;
create policy "admin_update_categories"
on public.categories
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "admin_delete_categories" on public.categories;
create policy "admin_delete_categories"
on public.categories
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- STORE SETTINGS (public read; admin update)
alter table public.store_settings enable row level security;

drop policy if exists "public_select_store_settings" on public.store_settings;
create policy "public_select_store_settings"
on public.store_settings
for select
to anon
using (true);

drop policy if exists "admin_select_store_settings" on public.store_settings;
create policy "admin_select_store_settings"
on public.store_settings
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "admin_update_store_settings" on public.store_settings;
create policy "admin_update_store_settings"
on public.store_settings
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- PRODUCTS (public catalog can read active, non-deleted products; admin CRUD)
alter table public.products enable row level security;

drop policy if exists "public_select_products" on public.products;
create policy "public_select_products"
on public.products
for select
to anon
using (coalesce(is_active, true) = true and deleted_at is null);

drop policy if exists "admin_select_products" on public.products;
create policy "admin_select_products"
on public.products
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "admin_insert_products" on public.products;
create policy "admin_insert_products"
on public.products
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "admin_update_products" on public.products;
create policy "admin_update_products"
on public.products
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "admin_delete_products" on public.products;
create policy "admin_delete_products"
on public.products
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- ============================================================
-- 🔓 GRANTS (required for PostgREST access)
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Public read
grant select on table public.products, public.categories, public.store_settings to anon;

-- Authenticated read
grant select on table public.products, public.categories, public.store_settings, public.orders, public.order_items, public.profiles to authenticated;

-- Customer checkout flow
grant insert on table public.orders, public.order_items to authenticated;

-- Admin mutations (RLS will gate actual access)
grant insert, update, delete on table public.products, public.categories to authenticated;
grant update on table public.store_settings, public.orders to authenticated;

-- ============================================================
-- ✅ END
-- ============================================================
