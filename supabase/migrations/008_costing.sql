-- Costing & profitability v11
create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  cost_date date not null default current_date,
  material_cost numeric(14,2) not null default 0,
  labor_cost numeric(14,2) not null default 0,
  machine_cost numeric(14,2) not null default 0,
  packaging_cost numeric(14,2) not null default 0,
  overhead_cost numeric(14,2) not null default 0,
  output_quantity numeric(14,3) not null,
  output_unit text not null,
  total_cost numeric(14,2) generated always as (material_cost + labor_cost + machine_cost + packaging_cost + overhead_cost) stored,
  unit_cost numeric(14,4) generated always as ((material_cost + labor_cost + machine_cost + packaging_cost + overhead_cost) / nullif(output_quantity,0)) stored,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.production_batch_costs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.production_batches(id) on delete cascade,
  material_cost numeric(14,2) not null default 0,
  labor_cost numeric(14,2) not null default 0,
  machine_cost numeric(14,2) not null default 0,
  packaging_cost numeric(14,2) not null default 0,
  overhead_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as (material_cost + labor_cost + machine_cost + packaging_cost + overhead_cost) stored,
  output_quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,4) generated always as ((material_cost + labor_cost + machine_cost + packaging_cost + overhead_cost) / nullif(output_quantity,0)) stored,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.product_costs enable row level security;
alter table public.production_batch_costs enable row level security;

drop policy if exists "authenticated users can read product costs" on public.product_costs;
drop policy if exists "authenticated users can manage product costs" on public.product_costs;
drop policy if exists "authenticated users can read batch costs" on public.production_batch_costs;
drop policy if exists "authenticated users can manage batch costs" on public.production_batch_costs;

create policy "authenticated users can read product costs" on public.product_costs for select to authenticated using (true);
create policy "authenticated users can manage product costs" on public.product_costs for all to authenticated using (true) with check (true);
create policy "authenticated users can read batch costs" on public.production_batch_costs for select to authenticated using (true);
create policy "authenticated users can manage batch costs" on public.production_batch_costs for all to authenticated using (true) with check (true);

create index if not exists idx_product_costs_product_date on public.product_costs(product_id, cost_date desc);
create index if not exists idx_batch_costs_batch on public.production_batch_costs(batch_id);
