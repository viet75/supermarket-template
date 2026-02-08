-- ============================================================
-- PATCH: store_settings (orari/chiusure/cutoff) + orders.fulfillment_date
-- Per progetti Supabase che hanno eseguito setup.sql in passato
-- SENZA le colonne weekly_hours, cutoff_time, closed_dates, ecc.
-- Eseguire da SQL Editor. Idempotente e safe (ADD COLUMN IF NOT EXISTS, COALESCE).
-- ============================================================

-- store_settings: colonne orari, cutoff, chiusure
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS weekly_hours jsonb,
ADD COLUMN IF NOT EXISTS cutoff_time text,
ADD COLUMN IF NOT EXISTS closed_dates jsonb,
ADD COLUMN IF NOT EXISTS closed_ranges jsonb,
ADD COLUMN IF NOT EXISTS accept_orders_when_closed boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome',
ADD COLUMN IF NOT EXISTS preparation_days integer NOT NULL DEFAULT 0;

-- Backfill default (solo dove NULL)
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

-- orders: data evasione
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_date date;

-- Ricarica schema PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';
