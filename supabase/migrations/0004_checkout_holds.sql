-- =====================================================================
-- Checkout holds for one-off pieces.
--
-- The problem this fixes: an online order used to take stock only when
-- the payment landed, so two shoppers could both reach Razorpay for the
-- last piece and both pay. Cash on delivery had the same race, between
-- checking stock and taking it.
--
-- How it works now:
--   * Placing an online order puts a short hold on its pieces. A hold
--     counts against availability until it expires or the order is paid.
--   * Checking availability and taking the hold (or, for cash on
--     delivery, the stock itself) happen in one transaction with the
--     product rows locked, so two checkouts for the same piece queue.
--   * Holds expire on their own. Availability simply ignores expired
--     holds, so there is no cleanup job that could fail and strand stock.
--   * When money arrives, the first payment for a piece wins. A payment
--     that lands for a piece already gone (its hold lapsed and someone
--     else bought it) is still recorded as paid -- the money has moved --
--     and flagged so the owner can refund or remake.
-- =====================================================================

alter table orders
  add column if not exists stock_conflict boolean not null default false;

create table if not exists stock_holds (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  product_id  uuid not null references products (id) on delete cascade,
  quantity    integer not null check (quantity > 0),
  -- Random per-device id. Lets a shopper replace or release their own
  -- hold without an account; it is never displayed anywhere.
  hold_key    text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists stock_holds_product_idx on stock_holds (product_id, expires_at);
create index if not exists stock_holds_key_idx     on stock_holds (hold_key);
create index if not exists stock_holds_order_idx   on stock_holds (order_id);

-- Nothing reads or writes holds through the API directly. Only the
-- security definer functions below touch this table.
alter table stock_holds enable row level security;


-- ---------------------------------------------------------------------
-- What a shopper can actually buy right now: stock minus live holds.
--
-- Taking a `products` row makes this a PostgREST computed field, so the
-- app selects it like a column: products?select=name,available_stock
-- ---------------------------------------------------------------------
create or replace function available_stock(p products)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    p.stock - coalesce(
      (select sum(h.quantity)::int
         from stock_holds h
        where h.product_id = p.id
          and h.expires_at > now()),
      0),
    0);
$fn$;

grant execute on function available_stock(products) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Create an order and secure its pieces, atomically.
--
-- Called only by the place-order Edge Function, which has already priced
-- the items from the database. Returns {ok: false, reason} rather than
-- raising, so the function can tell the shopper exactly what happened.
-- ---------------------------------------------------------------------
create or replace function create_order_with_hold(
  p_order        jsonb,
  p_items        jsonb,
  p_method       text,
  p_hold_key     text,
  p_hold_seconds integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_line          record;
  v_stock         integer;
  v_active        boolean;
  v_name          text;
  v_held          integer;
  v_next_release  timestamptz;
  v_hold_seconds  integer := least(greatest(coalesce(p_hold_seconds, 900), 60), 3600);
  v_order_id      uuid;
  v_order_number  text;
begin
  if p_method not in ('razorpay', 'cod') then
    return jsonb_build_object('ok', false, 'reason', 'bad_method');
  end if;
  if p_hold_key is null or length(p_hold_key) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'bad_hold_key');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  -- Expired holds no longer count for anything, so clear them out.
  delete from stock_holds where expires_at <= now();

  -- A fresh checkout from the same device replaces that device's earlier
  -- unfinished one. Otherwise a shopper who backs out of the payment
  -- screen and tries again would be blocked by their own hold.
  delete from stock_holds where hold_key = p_hold_key;

  -- Lock the pieces in a fixed order, so checkouts that share a piece
  -- wait for each other instead of deadlocking.
  perform 1
     from products
    where id in (select (x.item->>'product_id')::uuid
                   from jsonb_array_elements(p_items) as x(item))
    order by id
    for update;

  for v_line in
    select (x.item->>'product_id')::uuid        as product_id,
           sum((x.item->>'quantity')::int)::int as qty
      from jsonb_array_elements(p_items) as x(item)
     group by 1
  loop
    select stock, is_active, name
      into v_stock, v_active, v_name
      from products
     where id = v_line.product_id;

    if not found or not v_active then
      return jsonb_build_object('ok', false, 'reason', 'unavailable',
        'product_id', v_line.product_id, 'product_name', v_name);
    end if;

    if v_stock < v_line.qty then
      return jsonb_build_object('ok', false, 'reason', 'sold_out',
        'product_id', v_line.product_id, 'product_name', v_name, 'stock', v_stock);
    end if;

    select coalesce(sum(quantity), 0)::int, min(expires_at)
      into v_held, v_next_release
      from stock_holds
     where product_id = v_line.product_id
       and expires_at > now();

    if v_stock - v_held < v_line.qty then
      return jsonb_build_object('ok', false, 'reason', 'held',
        'product_id', v_line.product_id,
        'product_name', v_name,
        'available', greatest(v_stock - v_held, 0),
        'release_in_seconds',
          greatest(ceil(extract(epoch from (v_next_release - now())))::int, 0));
    end if;
  end loop;

  insert into orders (
    order_number, customer_name, customer_phone, customer_email,
    address_line1, address_line2, city, state, pincode,
    subtotal, delivery_charge, total,
    payment_method, payment_status, notes
  ) values (
    next_order_number(),
    p_order->>'customer_name',
    p_order->>'customer_phone',
    nullif(p_order->>'customer_email', ''),
    p_order->>'address_line1',
    nullif(p_order->>'address_line2', ''),
    p_order->>'city',
    p_order->>'state',
    p_order->>'pincode',
    (p_order->>'subtotal')::numeric,
    (p_order->>'delivery_charge')::numeric,
    (p_order->>'total')::numeric,
    p_method,
    'pending',
    nullif(p_order->>'notes', '')
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into order_items (
    order_id, product_id, product_name, product_code, product_image,
    unit_price, quantity, line_total
  )
  select v_order_id,
         (x.item->>'product_id')::uuid,
         x.item->>'product_name',
         x.item->>'product_code',
         x.item->>'product_image',
         (x.item->>'unit_price')::numeric,
         (x.item->>'quantity')::int,
         (x.item->>'line_total')::numeric
    from jsonb_array_elements(p_items) as x(item);

  if p_method = 'razorpay' then
    -- Online: hold the pieces while the shopper pays.
    insert into stock_holds (order_id, product_id, quantity, hold_key, expires_at)
    select v_order_id, agg.product_id, agg.qty, p_hold_key,
           now() + make_interval(secs => v_hold_seconds)
      from (select (x.item->>'product_id')::uuid        as product_id,
                   sum((x.item->>'quantity')::int)::int as qty
              from jsonb_array_elements(p_items) as x(item)
             group by 1) agg;
  else
    -- Cash on delivery is confirmed now, so take the stock now.
    update products p
       set stock = p.stock - agg.qty
      from (select (x.item->>'product_id')::uuid        as product_id,
                   sum((x.item->>'quantity')::int)::int as qty
              from jsonb_array_elements(p_items) as x(item)
             group by 1) agg
     where p.id = agg.product_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'hold_seconds', case when p_method = 'razorpay' then v_hold_seconds end
  );
end
$fn$;

revoke all on function create_order_with_hold(jsonb, jsonb, text, text, integer)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- A shopper gave up on paying: free their pieces for everyone else now
-- rather than when the hold runs out. Only the holder knows the key.
-- ---------------------------------------------------------------------
create or replace function release_holds(p_hold_key text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  if p_hold_key is null or length(p_hold_key) < 16 then
    return 0;
  end if;

  delete from stock_holds where hold_key = p_hold_key;
  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

revoke all on function release_holds(text) from public;
grant execute on function release_holds(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Payment settlement, now hold-aware. Replaces the 0003 version.
--
-- Still idempotent -- the payment_status guard means only the first call
-- touches stock. New: stock is taken only if it is still there, and an
-- order paid for a piece that has already gone is flagged, not dropped.
-- ---------------------------------------------------------------------
create or replace function mark_order_paid(
  p_razorpay_order_id   text,
  p_razorpay_payment_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_order    orders%rowtype;
  v_claimed  boolean := false;
  v_conflict boolean := false;
  v_line     record;
  v_stock    integer;
begin
  update orders
     set payment_status      = 'paid',
         razorpay_payment_id = p_razorpay_payment_id,
         status              = case when status = 'placed' then 'confirmed' else status end
   where razorpay_order_id = p_razorpay_order_id
     and payment_status <> 'paid'
  returning * into v_order;

  if found then
    v_claimed := true;

    perform 1
       from products
      where id in (select product_id from order_items
                    where order_id = v_order.id and product_id is not null)
      order by id
      for update;

    for v_line in
      select product_id, sum(quantity)::int as qty
        from order_items
       where order_id = v_order.id
         and product_id is not null
       group by product_id
    loop
      select stock into v_stock from products where id = v_line.product_id;

      if v_stock is not null and v_stock >= v_line.qty then
        update products set stock = stock - v_line.qty where id = v_line.product_id;
      else
        v_conflict := true;
      end if;
    end loop;

    -- A piece deleted from the catalogue mid-checkout cannot be sent either.
    if exists (select 1 from order_items where order_id = v_order.id and product_id is null) then
      v_conflict := true;
    end if;

    delete from stock_holds where order_id = v_order.id;

    if v_conflict then
      update orders set stock_conflict = true where id = v_order.id;
      v_order.stock_conflict := true;
    end if;
  else
    select * into v_order
      from orders
     where razorpay_order_id = p_razorpay_order_id;
  end if;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  return jsonb_build_object(
    'ok',             true,
    'claimed',        v_claimed,
    'order_number',   v_order.order_number,
    'total',          v_order.total,
    'payment_status', v_order.payment_status,
    'stock_conflict', v_order.stock_conflict
  );
end
$fn$;

revoke all on function mark_order_paid(text, text) from public, anon, authenticated;


-- Cash-on-delivery stock is now taken inside create_order_with_hold.
-- The old separate step was the race; remove it so nothing calls it.
drop function if exists reserve_stock_for_order(uuid);


-- ---------------------------------------------------------------------
-- Customer order lookup: now says when a paid piece was already gone.
-- ---------------------------------------------------------------------
create or replace function lookup_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'order_number',    o.order_number,
    'customer_name',   o.customer_name,
    'status',          o.status,
    'payment_status',  o.payment_status,
    'payment_method',  o.payment_method,
    'stock_conflict',  o.stock_conflict,
    'subtotal',        o.subtotal,
    'delivery_charge', o.delivery_charge,
    'total',           o.total,
    'created_at',      o.created_at,
    'city',            o.city,
    'pincode',         o.pincode,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name',  i.product_name,
        'product_code',  i.product_code,
        'product_image', i.product_image,
        'unit_price',    i.unit_price,
        'quantity',      i.quantity,
        'line_total',    i.line_total))
      from order_items i
      where i.order_id = o.id), '[]'::jsonb)
  )
  into result
  from orders o
  where o.order_number = upper(trim(p_order_number))
    and right(regexp_replace(o.customer_phone, '[^0-9]', '', 'g'), 10)
      = right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 10);

  return result;
end
$fn$;


-- ---------------------------------------------------------------------
-- Dashboard counters: add the orders that need the owner's attention.
-- ---------------------------------------------------------------------
create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  result jsonb;
begin
  if not is_admin() then
    raise exception 'not authorised';
  end if;

  select jsonb_build_object(
    'products_total',  (select count(*) from products),
    'products_live',   (select count(*) from products where is_active),
    'out_of_stock',    (select count(*) from products where is_active and stock = 0),
    'orders_total',    (select count(*) from orders),
    'orders_new',      (select count(*) from orders where status = 'placed'),
    'orders_today',    (select count(*) from orders
                         where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata')),
    'stock_conflicts', (select count(*) from orders
                         where stock_conflict and status <> 'cancelled'),
    'revenue_paid',    (select coalesce(sum(total), 0) from orders where payment_status = 'paid'),
    'revenue_month',   (select coalesce(sum(total), 0) from orders
                         where payment_status = 'paid'
                           and created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata'))
  )
  into result;

  return result;
end
$fn$;


-- Make PostgREST pick up the new computed field and functions now.
notify pgrst, 'reload schema';
