-- =====================================================================
-- Payment settlement.
--
-- Both the browser callback and the Razorpay webhook call this, and
-- Razorpay retries webhooks. It must therefore be idempotent: the
-- "where payment_status <> 'paid'" guard means stock is decremented
-- exactly once no matter how many times this runs.
-- =====================================================================

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
  v_order   orders%rowtype;
  v_claimed boolean := false;
begin
  -- Claim the order. Only the first caller to get past this guard
  -- sees a row returned, so only the first caller touches stock.
  update orders
     set payment_status      = 'paid',
         razorpay_payment_id = p_razorpay_payment_id,
         status              = case when status = 'placed' then 'confirmed' else status end
   where razorpay_order_id = p_razorpay_order_id
     and payment_status <> 'paid'
  returning * into v_order;

  if found then
    v_claimed := true;

    update products p
       set stock = greatest(p.stock - i.quantity, 0)
      from order_items i
     where i.order_id = v_order.id
       and p.id = i.product_id;
  else
    -- Already settled (or unknown order). Read it back so the caller
    -- still gets the order number to show the customer.
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
    'payment_status', v_order.payment_status
  );
end
$fn$;

revoke all on function mark_order_paid(text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Mark a Razorpay attempt as failed. Never downgrades a paid order.
-- ---------------------------------------------------------------------
create or replace function mark_order_failed(p_razorpay_order_id text)
returns void
language sql
volatile
security definer
set search_path = public
as $fn$
  update orders
     set payment_status = 'failed'
   where razorpay_order_id = p_razorpay_order_id
     and payment_status = 'pending';
$fn$;

revoke all on function mark_order_failed(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Cash-on-delivery orders reserve stock the moment they are placed.
-- ---------------------------------------------------------------------
create or replace function reserve_stock_for_order(p_order_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $fn$
  update products p
     set stock = greatest(p.stock - i.quantity, 0)
    from order_items i
   where i.order_id = p_order_id
     and p.id = i.product_id;
$fn$;

revoke all on function reserve_stock_for_order(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Admin dashboard counters in one round trip.
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
    'revenue_paid',    (select coalesce(sum(total), 0) from orders where payment_status = 'paid'),
    'revenue_month',   (select coalesce(sum(total), 0) from orders
                         where payment_status = 'paid'
                           and created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata'))
  )
  into result;

  return result;
end
$fn$;

grant execute on function admin_dashboard_stats() to authenticated;
