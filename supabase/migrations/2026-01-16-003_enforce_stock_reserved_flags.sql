-- Enforce stock_reserved semantics:
-- stock_reserved = TRUE only for temporary card_online pending reservations

create or replace function public.orders_enforce_stock_flags()
returns trigger
language plpgsql
as $$
begin
  -- When an order becomes PAID, it cannot be a temporary reservation anymore
  if new.payment_status = 'paid'
     and (old.payment_status is distinct from new.payment_status) then
    new.stock_reserved := false;
    new.reserve_expires_at := null;
  end if;

  -- Final states: never reserved
  if new.status in ('cancelled', 'delivered') then
    new.stock_reserved := false;
    new.reserve_expires_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_enforce_stock_flags on public.orders;

create trigger trg_orders_enforce_stock_flags
before update on public.orders
for each row
execute function public.orders_enforce_stock_flags();

-- One-time cleanup safety (legacy paid orders)
update public.orders
set stock_reserved = false,
    reserve_expires_at = null
where payment_method = 'card_online'
  and payment_status = 'paid'
  and stock_reserved = true;

notify pgrst, 'reload schema';
