-- Fix multi-slot same day: do not show "reopens at next slot" while already inside an earlier slot (NOT is_open_today guard).

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
  -- Multi-slot: only "reopens at next slot today" when closed NOW (between slots / before first slot).
  -- If already inside a slot, has_future_slot_today is still true (later slot exists) — must not override.
IF NOT is_open_today AND has_future_slot_today AND next_date = d THEN
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
