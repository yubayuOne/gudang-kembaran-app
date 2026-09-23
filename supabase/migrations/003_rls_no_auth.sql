-- Gudang Kembaran v15
-- The current application does not have a login/authentication screen.
-- Allow the Supabase anon role to use the core tracking tables so the app
-- can actually create products, recipes, and movements without a session.
-- If authentication is added later, these anon policies should be removed
-- and access should be restricted to authenticated users.

alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_batch_items enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

-- Idempotent policies for the current no-login application.
drop policy if exists "anon can read products" on public.products;
drop policy if exists "anon can write products" on public.products;
drop policy if exists "anon can read recipes" on public.recipes;
drop policy if exists "anon can write recipes" on public.recipes;
drop policy if exists "anon can read recipe items" on public.recipe_items;
drop policy if exists "anon can write recipe items" on public.recipe_items;
drop policy if exists "anon can read production batches" on public.production_batches;
drop policy if exists "anon can write production batches" on public.production_batches;
drop policy if exists "anon can read production items" on public.production_batch_items;
drop policy if exists "anon can write production items" on public.production_batch_items;
drop policy if exists "anon can read stock balances" on public.stock_balances;
drop policy if exists "anon can read stock movements" on public.stock_movements;

do $$
begin
  create policy "anon can read products"
    on public.products for select to anon using (true);
  create policy "anon can write products"
    on public.products for all to anon using (true) with check (true);

  create policy "anon can read recipes"
    on public.recipes for select to anon using (true);
  create policy "anon can write recipes"
    on public.recipes for all to anon using (true) with check (true);

  create policy "anon can read recipe items"
    on public.recipe_items for select to anon using (true);
  create policy "anon can write recipe items"
    on public.recipe_items for all to anon using (true) with check (true);

  create policy "anon can read production batches"
    on public.production_batches for select to anon using (true);
  create policy "anon can write production batches"
    on public.production_batches for all to anon using (true) with check (true);

  create policy "anon can read production items"
    on public.production_batch_items for select to anon using (true);
  create policy "anon can write production items"
    on public.production_batch_items for all to anon using (true) with check (true);

  create policy "anon can read stock balances"
    on public.stock_balances for select to anon using (true);
  create policy "anon can read stock movements"
    on public.stock_movements for select to anon using (true);
exception when duplicate_object then null;
end $$;

-- The RPCs are SECURITY DEFINER and are therefore the intended write path
-- for stock movement and production transactions.
grant execute on function public.record_stock_movement(uuid,numeric,public.stock_movement_type,text,uuid,uuid,text) to anon;
grant execute on function public.create_production_batch(text,uuid,numeric,numeric,text,date,jsonb,text) to anon;
grant execute on function public.stock_balance(uuid) to anon;

notify pgrst, 'reload schema';
