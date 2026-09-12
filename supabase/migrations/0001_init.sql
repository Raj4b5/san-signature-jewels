-- =====================================================================
-- San Signature Jewels - initial schema
-- Handmade / imitation jewellery catalogue + orders
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Admin allow-list. A row here grants full write access to the store.
-- ---------------------------------------------------------------------
create table if not exists admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from admin_users a where a.user_id = auth.uid());
$fn$;

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  image_url  text,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Products
-- mrp   = the struck-through "was" price (optional)
-- price = what the customer actually pays
-- ---------------------------------------------------------------------
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text,
  category_id   uuid references categories (id) on delete set null,
  mrp           numeric(10,2),
  price         numeric(10,2) not null check (price >= 0),
  stock         integer not null default 1 check (stock >= 0),
  material      text,
  weight_grams  numeric(8,2),
  images        text[] not null default '{}',
  tags          text[] not null default '{}',
  is_active     boolean not null default true,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  discount_percent integer generated always as (
    case
      when mrp is not null and mrp > 0 and mrp > price
        then floor(((mrp - price) / mrp) * 100)::int
      else 0
    end
  ) stored
);

create index if not exists products_category_idx on products (category_id);
create index if not exists products_active_idx   on products (is_active, created_at desc);
create index if not exists products_featured_idx on products (is_featured) where is_featured;
create index if not exists products_search_idx   on products
  using gin (to_tsvector('simple',
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(code, '')));

-- ---------------------------------------------------------------------
-- Store settings (single row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists settings (
  id                     int primary key default 1 check (id = 1),
  store_name             text    not null default 'San Signature Jewels',
  tagline                text    not null default 'Elegance Crafted for You',
  phone_primary          text    not null default '7981492668',
  phone_secondary        text    default '8083583449',
  whatsapp_number        text    not null default '917981492668',
  email                  text,
  address                text    not null default 'Flat No. 109, Srinivasam by Sai Balaji Apartment, Puppalguda, Manikonda, Hyderabad, Telangana 500089',
  instagram_url          text,
  delivery_charge        numeric(10,2) not null default 0,
  free_delivery_above    numeric(10,2) not null default 999,
  cod_enabled            boolean not null default true,
  online_payment_enabled boolean not null default true,
  announcement           text,
  sale_banner_text       text,
  sale_banner_active     boolean not null default false,
  updated_at             timestamptz not null default now()
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique,
  customer_name       text not null,
  customer_phone      text not null,
  customer_email      text,
  address_line1       text not null,
  address_line2       text,
  city                text not null,
  state               text not null,
  pincode             text not null,
  subtotal            numeric(10,2) not null,
  delivery_charge     numeric(10,2) not null default 0,
  total               numeric(10,2) not null,
  payment_method      text not null check (payment_method in ('razorpay', 'cod')),
  payment_status      text not null default 'pending'
                      check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  razorpay_order_id   text,
  razorpay_payment_id text,
  status              text not null default 'placed'
                      check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_phone_idx   on orders (customer_phone);
create index if not exists orders_rzp_idx     on orders (razorpay_order_id);

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders (id) on delete cascade,
  product_id    uuid references products (id) on delete set null,
  product_name  text not null,
  product_code  text not null,
  product_image text,
  unit_price    numeric(10,2) not null,
  quantity      integer not null check (quantity > 0),
  line_total    numeric(10,2) not null
);

create index if not exists order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end
$fn$;

drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();

drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();

drop trigger if exists settings_touch on settings;
create trigger settings_touch before update on settings
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Sequential, human-readable order numbers: SJ-2026-1001
-- ---------------------------------------------------------------------
create sequence if not exists order_seq start 1001;

create or replace function next_order_number()
returns text
language sql
volatile
as $fn$
  select 'SJ-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || nextval('order_seq')::text;
$fn$;

-- ---------------------------------------------------------------------
-- Customer-facing order lookup.
-- Orders are NOT publicly readable; this is the only way a shopper can
-- see one, and it requires both the order number and the phone used.
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

revoke all on function lookup_order(text, text) from public;
grant execute on function lookup_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table products    enable row level security;
alter table categories  enable row level security;
alter table settings    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table admin_users enable row level security;

-- Shoppers may read only live catalogue rows.
drop policy if exists products_public_read on products;
create policy products_public_read on products
  for select using (is_active = true);

drop policy if exists categories_public_read on categories;
create policy categories_public_read on categories
  for select using (is_active = true);

drop policy if exists settings_public_read on settings;
create policy settings_public_read on settings
  for select using (true);

-- Admins may do anything.
drop policy if exists products_admin_all on products;
create policy products_admin_all on products
  for all using (is_admin()) with check (is_admin());

drop policy if exists categories_admin_all on categories;
create policy categories_admin_all on categories
  for all using (is_admin()) with check (is_admin());

drop policy if exists settings_admin_write on settings;
create policy settings_admin_write on settings
  for update using (is_admin()) with check (is_admin());

drop policy if exists orders_admin_all on orders;
create policy orders_admin_all on orders
  for all using (is_admin()) with check (is_admin());

drop policy if exists order_items_admin_all on order_items;
create policy order_items_admin_all on order_items
  for all using (is_admin()) with check (is_admin());

drop policy if exists admin_users_self_read on admin_users;
create policy admin_users_self_read on admin_users
  for select using (user_id = auth.uid());

-- NOTE: there is deliberately no INSERT policy for anon on orders.
-- Orders are created only by the place-order Edge Function using the
-- service role, so prices are always recomputed from the database and
-- can never be set by the client.

-- ---------------------------------------------------------------------
-- Seed categories
-- ---------------------------------------------------------------------
insert into categories (name, slug, sort_order) values
  ('Necklaces',        'necklaces',    1),
  ('Earrings',         'earrings',     2),
  ('Bangles',          'bangles',      3),
  ('Bridal Sets',      'bridal-sets',  4),
  ('Temple Jewellery', 'temple',       5),
  ('Haaram',           'haaram',       6),
  ('Chokers',          'chokers',      7),
  ('Maang Tikka',      'maang-tikka',  8),
  ('Rings',            'rings',        9),
  ('Anklets',          'anklets',     10),
  ('Gifting',          'gifting',     11)
on conflict (slug) do nothing;
