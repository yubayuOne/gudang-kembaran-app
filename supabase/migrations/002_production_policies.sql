-- Policies needed by the Production Order screen.
-- Keep writes limited to authenticated operators; role-based policies can be tightened later.

alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_batches enable row level security;
alter table public.warehouses enable row level security;

create policy "authenticated users can read recipes" on public.recipes for select to authenticated using (true);
create policy "authenticated users can read recipe items" on public.recipe_items for select to authenticated using (true);
create policy "authenticated users can read production orders" on public.production_orders for select to authenticated using (true);
create policy "authenticated users can create production orders" on public.production_orders for insert to authenticated with check (true);
create policy "authenticated users can read production batches" on public.production_batches for select to authenticated using (true);
create policy "authenticated users can create production batches" on public.production_batches for insert to authenticated with check (true);
create policy "authenticated users can read warehouses" on public.warehouses for select to authenticated using (true);
