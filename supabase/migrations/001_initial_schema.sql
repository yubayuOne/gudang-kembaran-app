create extension if not exists pgcrypto;

create type product_type as enum ('RAW_MATERIAL','WIP','FINISHED_GOOD','PACKAGING','SUPPLY');
create type production_status as enum ('DRAFT','PLANNED','IN_PROGRESS','COMPLETED','CANCELLED');
create type order_status as enum ('DRAFT','CONFIRMED','PROCESSING','READY','DELIVERED','COMPLETED','CANCELLED');
create type payment_status as enum ('UNPAID','PARTIAL','PAID','OVERDUE','CANCELLED');

create table public.product_categories (
  id uuid primary key default gen_random_uuid(), name text not null, parent_id uuid references public.product_categories(id), created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), sku text unique not null, name text not null, category_id uuid references public.product_categories(id), product_type product_type not null, unit text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, phone text, email text, address text, payment_term integer not null default 0, notes text, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, customer_type text not null default 'RETAIL', phone text, email text, address text, payment_term integer not null default 0, credit_limit numeric(14,2) not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.price_lists (
  id uuid primary key default gen_random_uuid(), name text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.price_list_items (
  id uuid primary key default gen_random_uuid(), price_list_id uuid not null references public.price_lists(id) on delete cascade, product_id uuid not null references public.products(id), price numeric(14,2) not null, min_quantity numeric(14,3) not null default 1, unique(price_list_id, product_id, min_quantity)
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), name text not null, version integer not null default 1, output_quantity numeric(14,3) not null, output_unit text not null, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.recipe_items (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade, material_id uuid not null references public.products(id), quantity numeric(14,3) not null, unit text not null, waste_percent numeric(6,3) not null default 0
);
create table public.warehouses (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, address text, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.stock_balances (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), warehouse_id uuid not null references public.warehouses(id), quantity numeric(14,3) not null default 0, reserved_quantity numeric(14,3) not null default 0, updated_at timestamptz not null default now(), unique(product_id, warehouse_id)
);
create table public.production_orders (
  id uuid primary key default gen_random_uuid(), order_number text unique not null, product_id uuid not null references public.products(id), recipe_id uuid references public.recipes(id), planned_quantity numeric(14,3) not null, actual_quantity numeric(14,3) not null default 0, unit text not null, status production_status not null default 'DRAFT', planned_date date, started_at timestamptz, completed_at timestamptz, notes text, created_at timestamptz not null default now()
);
create table public.production_batches (
  id uuid primary key default gen_random_uuid(), batch_number text unique not null, production_order_id uuid not null references public.production_orders(id), product_id uuid not null references public.products(id), input_quantity numeric(14,3) not null default 0, output_quantity numeric(14,3) not null default 0, waste_quantity numeric(14,3) not null default 0, yield_percent numeric(7,3), status production_status not null default 'DRAFT', started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.roasting_records (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.production_batches(id) on delete cascade, input_product_id uuid not null references public.products(id), input_quantity numeric(14,3) not null, output_product_id uuid not null references public.products(id), output_quantity numeric(14,3) not null, roast_level text, machine text, temperature numeric(8,2), duration_minutes integer, waste_quantity numeric(14,3) not null default 0, notes text
);
create table public.grinding_records (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.production_batches(id) on delete cascade, input_product_id uuid not null references public.products(id), input_quantity numeric(14,3) not null, output_product_id uuid not null references public.products(id), output_quantity numeric(14,3) not null, grind_size text, machine text, waste_quantity numeric(14,3) not null default 0, notes text
);
create table public.packaging_records (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.production_batches(id) on delete cascade, product_id uuid not null references public.products(id), bulk_product_id uuid not null references public.products(id), input_quantity numeric(14,3) not null, packaging_product_id uuid references public.products(id), packaging_quantity numeric(14,3) not null default 0, output_quantity numeric(14,3) not null, waste_quantity numeric(14,3) not null default 0, notes text
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), warehouse_id uuid not null references public.warehouses(id), batch_id uuid references public.production_batches(id), movement_type text not null, quantity numeric(14,3) not null, reference_type text, reference_id uuid, movement_date timestamptz not null default now(), notes text, created_at timestamptz not null default now()
);
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(), order_number text unique not null, customer_id uuid not null references public.customers(id), price_list_id uuid references public.price_lists(id), order_date timestamptz not null default now(), status order_status not null default 'DRAFT', subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, total numeric(14,2) not null default 0, notes text, created_at timestamptz not null default now()
);
create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(), sales_order_id uuid not null references public.sales_orders(id) on delete cascade, product_id uuid not null references public.products(id), quantity numeric(14,3) not null, unit_price numeric(14,2) not null, discount numeric(14,2) not null default 0, subtotal numeric(14,2) not null
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), invoice_number text unique not null, sales_order_id uuid not null references public.sales_orders(id), customer_id uuid not null references public.customers(id), invoice_date timestamptz not null default now(), due_date date, subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, total numeric(14,2) not null default 0, paid_amount numeric(14,2) not null default 0, status payment_status not null default 'UNPAID'
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), payment_number text unique not null, invoice_id uuid not null references public.invoices(id), payment_date timestamptz not null default now(), amount numeric(14,2) not null, payment_method text not null, reference text, notes text, created_at timestamptz not null default now()
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), delivery_number text unique not null, sales_order_id uuid not null references public.sales_orders(id), customer_id uuid not null references public.customers(id), delivery_date timestamptz, status text not null default 'PENDING', courier text, tracking_number text, notes text
);
create table public.delivery_items (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.deliveries(id) on delete cascade, product_id uuid not null references public.products(id), quantity numeric(14,3) not null
);

alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

create policy "authenticated users can read products" on public.products for select to authenticated using (true);
create policy "authenticated users can read categories" on public.product_categories for select to authenticated using (true);
create policy "authenticated users can read customers" on public.customers for select to authenticated using (true);
create policy "authenticated users can read suppliers" on public.suppliers for select to authenticated using (true);
create policy "authenticated users can read stock" on public.stock_balances for select to authenticated using (true);
create policy "authenticated users can read stock movements" on public.stock_movements for select to authenticated using (true);
