-- Inventory v7: atomic stock ledger + balance update.
-- Safe to run more than once during development.

alter table public.stock_movements enable row level security;
alter table public.stock_balances enable row level security;
alter table public.warehouses enable row level security;

drop policy if exists "authenticated users can read stock movements" on public.stock_movements;
create policy "authenticated users can read stock movements"
on public.stock_movements for select to authenticated using (true);

drop policy if exists "authenticated users can read stock" on public.stock_balances;
create policy "authenticated users can read stock"
on public.stock_balances for select to authenticated using (true);

drop policy if exists "authenticated users can read warehouses" on public.warehouses;
create policy "authenticated users can read warehouses"
on public.warehouses for select to authenticated using (true);

create or replace function public.apply_stock_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_movement_date timestamptz default now(),
  p_notes text default null,
  p_allow_negative boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.stock_balances%rowtype;
  v_movement_id uuid;
  v_new_quantity numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_product_id is null or p_warehouse_id is null then
    raise exception 'PRODUCT_AND_WAREHOUSE_REQUIRED';
  end if;

  if p_quantity is null or p_quantity = 0 then
    raise exception 'QUANTITY_MUST_NOT_BE_ZERO';
  end if;

  if nullif(trim(coalesce(p_movement_type, '')), '') is null then
    raise exception 'MOVEMENT_TYPE_REQUIRED';
  end if;

  insert into public.stock_balances(product_id, warehouse_id, quantity, reserved_quantity)
  values (p_product_id, p_warehouse_id, 0, 0)
  on conflict (product_id, warehouse_id) do nothing;

  select * into v_balance
  from public.stock_balances
  where product_id = p_product_id and warehouse_id = p_warehouse_id
  for update;

  v_new_quantity := v_balance.quantity + p_quantity;

  if not p_allow_negative and v_new_quantity < 0 then
    raise exception 'INSUFFICIENT_STOCK: available %, requested %', v_balance.quantity, abs(p_quantity);
  end if;

  insert into public.stock_movements(
    product_id, warehouse_id, quantity, movement_type,
    reference_type, reference_id, movement_date, notes
  ) values (
    p_product_id, p_warehouse_id, p_quantity, trim(p_movement_type),
    p_reference_type, p_reference_id, coalesce(p_movement_date, now()), p_notes
  )
  returning id into v_movement_id;

  update public.stock_balances
  set quantity = v_new_quantity,
      updated_at = now()
  where id = v_balance.id;

  return v_movement_id;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text, uuid, timestamptz, text, boolean) from public;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text, uuid, timestamptz, text, boolean) to authenticated;

-- Development seed: one default warehouse when none exists.
insert into public.warehouses(code, name)
select 'MAIN', 'Gudang Utama'
where not exists (select 1 from public.warehouses);
