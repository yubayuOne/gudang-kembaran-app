create extension if not exists pgcrypto;

do $$ begin
  create type public.product_type as enum ('RAW_MATERIAL','WIP','FINISHED_GOOD','PACKAGING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_movement_type as enum ('IN','PRODUCTION_USE','PRODUCTION_OUTPUT','OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.production_status as enum ('DRAFT','COMPLETED','CANCELLED');
exception when duplicate_object then null; end $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  product_type public.product_type not null,
  unit text not null,
  minimum_stock numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  output_quantity numeric(14,3) not null check (output_quantity > 0),
  output_unit text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, version)
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  material_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null
);

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text unique not null,
  product_id uuid not null references public.products(id),
  planned_output numeric(14,3),
  actual_output numeric(14,3) not null check (actual_output > 0),
  unit text not null,
  status public.production_status not null default 'COMPLETED',
  production_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.production_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  material_id uuid not null references public.products(id),
  planned_quantity numeric(14,3),
  actual_quantity numeric(14,3) not null check (actual_quantity > 0),
  unit text not null
);

create table public.stock_balances (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type public.stock_movement_type not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  batch_id uuid references public.production_batches(id),
  reference_type text,
  reference_id uuid,
  movement_date timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index stock_movements_product_date_idx on public.stock_movements(product_id, movement_date desc);
create index stock_movements_batch_idx on public.stock_movements(batch_id);
create index production_batches_date_idx on public.production_batches(production_date desc);

alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_batch_items enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

do $$ begin
  create policy "authenticated can read products" on public.products for select to authenticated using (true);
  create policy "authenticated can write products" on public.products for all to authenticated using (true) with check (true);
  create policy "authenticated can read recipes" on public.recipes for select to authenticated using (true);
  create policy "authenticated can write recipes" on public.recipes for all to authenticated using (true) with check (true);
  create policy "authenticated can read recipe items" on public.recipe_items for select to authenticated using (true);
  create policy "authenticated can write recipe items" on public.recipe_items for all to authenticated using (true) with check (true);
  create policy "authenticated can read production batches" on public.production_batches for select to authenticated using (true);
  create policy "authenticated can write production batches" on public.production_batches for all to authenticated using (true) with check (true);
  create policy "authenticated can read production items" on public.production_batch_items for select to authenticated using (true);
  create policy "authenticated can write production items" on public.production_batch_items for all to authenticated using (true) with check (true);
  create policy "authenticated can read stock balances" on public.stock_balances for select to authenticated using (true);
  create policy "authenticated can read stock movements" on public.stock_movements for select to authenticated using (true);
exception when duplicate_object then null; end $$;

create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type public.stock_movement_type,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_batch_id uuid default null,
  p_notes text default null
) returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
  v_row public.stock_movements;
begin
  if p_quantity = 0 then raise exception 'Quantity tidak boleh 0'; end if;
  insert into public.stock_balances(product_id, quantity, updated_at)
  values (p_product_id, 0, now()) on conflict (product_id) do nothing;

  select quantity into v_balance from public.stock_balances where product_id = p_product_id for update;
  if v_balance + p_quantity < 0 then
    raise exception 'Stok % tidak mencukupi. Stok tersedia: %, perubahan: %', p_product_id, v_balance, p_quantity;
  end if;

  update public.stock_balances set quantity = v_balance + p_quantity, updated_at = now() where product_id = p_product_id;
  insert into public.stock_movements(product_id, movement_type, quantity, batch_id, reference_type, reference_id, notes)
  values (p_product_id, p_movement_type, p_quantity, p_batch_id, p_reference_type, p_reference_id, p_notes)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.record_stock_movement(uuid,numeric,public.stock_movement_type,text,uuid,uuid,text) to authenticated;

create or replace function public.create_production_batch(
  p_batch_number text,
  p_product_id uuid,
  p_planned_output numeric,
  p_actual_output numeric,
  p_unit text,
  p_production_date date,
  p_items jsonb,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_batch_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_material uuid;
begin
  if p_actual_output <= 0 then raise exception 'Output produksi harus lebih dari 0'; end if;
  insert into public.production_batches(batch_number, product_id, planned_output, actual_output, unit, production_date, notes)
  values (p_batch_number, p_product_id, p_planned_output, p_actual_output, p_unit, coalesce(p_production_date,current_date), p_notes)
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_material := (v_item->>'material_id')::uuid;
    v_qty := (v_item->>'actual_quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Qty bahan harus lebih dari 0'; end if;
    insert into public.production_batch_items(batch_id, material_id, planned_quantity, actual_quantity, unit)
    values (v_batch_id, v_material, nullif(v_item->>'planned_quantity','')::numeric, v_qty, coalesce(v_item->>'unit',''));
    perform public.record_stock_movement(v_material, -v_qty, 'PRODUCTION_USE', 'production_batch', v_batch_id, v_batch_id, 'Pemakaian produksi');
  end loop;

  perform public.record_stock_movement(p_product_id, p_actual_output, 'PRODUCTION_OUTPUT', 'production_batch', v_batch_id, v_batch_id, 'Hasil produksi');
  return v_batch_id;
exception when others then
  raise;
end;
$$;

grant execute on function public.create_production_batch(text,uuid,numeric,numeric,text,date,jsonb,text) to authenticated;

create or replace view public.stock_ledger as
select
  m.id, m.movement_date, m.product_id, p.sku, p.name as product_name, p.unit,
  m.movement_type, m.quantity, m.batch_id, b.batch_number,
  m.reference_type, m.reference_id, m.notes
from public.stock_movements m
join public.products p on p.id = m.product_id
left join public.production_batches b on b.id = m.batch_id;

create or replace function public.stock_balance(p_product_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity),0) from public.stock_movements where product_id = p_product_id;
$$;
grant execute on function public.stock_balance(uuid) to authenticated;
