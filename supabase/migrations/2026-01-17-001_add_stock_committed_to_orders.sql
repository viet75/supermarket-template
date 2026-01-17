alter table public.orders
add column if not exists stock_committed boolean not null default false;

create index if not exists idx_orders_stock_committed
on public.orders(stock_committed);

-- Backfill prudente: se storicamente avevi stock_reserved=true,
-- vuol dire che lo stock era stato scalato.
update public.orders
set stock_committed = true
where stock_reserved = true;

notify pgrst, 'reload schema';
