-- v12 Purchasing -> Costing integration.
-- Records each received purchase cost and maintains a weighted-average current material cost.

create table if not exists public.material_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  average_unit_cost numeric(14,4) not null default 0,
  last_unit_cost numeric(14,4) not null default 0,
  total_quantity numeric(14,3) not null default 0,
  total_value numeric(18,4) not null default 0,
  last_receipt_id uuid references public.purchase_receipts(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.material_cost_layers (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  receipt_item_id uuid not null references public.purchase_receipt_items(id) on delete cascade,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,4) not null,
  total_cost numeric(18,4) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_cost_layers_product_date
  on public.material_cost_layers(product_id, created_at desc);

alter table public.material_costs enable row level security;
alter table public.material_cost_layers enable row level security;

drop policy if exists "authenticated users can read material costs" on public.material_costs;
drop policy if exists "authenticated users can manage material costs" on public.material_costs;
drop policy if exists "authenticated users can read material cost layers" on public.material_cost_layers;
drop policy if exists "authenticated users can manage material cost layers" on public.material_cost_layers;

create policy "authenticated users can read material costs"
  on public.material_costs for select to authenticated using (true);
create policy "authenticated users can manage material costs"
  on public.material_costs for all to authenticated using (true) with check (true);
create policy "authenticated users can read material cost layers"
  on public.material_cost_layers for select to authenticated using (true);
create policy "authenticated users can manage material cost layers"
  on public.material_cost_layers for all to authenticated using (true) with check (true);

-- Replace receiving function so every posted receipt also updates weighted-average cost.
create or replace function public.receive_purchase(
  p_purchase_order_id uuid,
  p_warehouse_id uuid,
  p_receipt_number text,
  p_receipt_date timestamptz,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_item jsonb;
  v_po_item public.purchase_order_items%rowtype;
  v_receipt_item_id uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_remaining numeric;
  v_total_received numeric;
  v_all_received boolean;
  v_existing_qty numeric;
  v_existing_value numeric;
  v_new_qty numeric;
  v_new_value numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_purchase_order_id is null or p_warehouse_id is null then raise exception 'PURCHASE_ORDER_AND_WAREHOUSE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_receipt_number, '')), '') is null then raise exception 'RECEIPT_NUMBER_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'RECEIPT_ITEMS_REQUIRED'; end if;
  if exists (select 1 from public.purchase_receipts where receipt_number = trim(p_receipt_number)) then raise exception 'RECEIPT_NUMBER_EXISTS'; end if;

  insert into public.purchase_receipts(receipt_number, purchase_order_id, warehouse_id, receipt_date, notes)
  values (trim(p_receipt_number), p_purchase_order_id, p_warehouse_id, coalesce(p_receipt_date, now()), nullif(trim(p_notes), ''))
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_po_item
    from public.purchase_order_items
    where id = (v_item->>'purchase_order_item_id')::uuid
      and purchase_order_id = p_purchase_order_id
    for update;

    if not found then raise exception 'PURCHASE_ORDER_ITEM_NOT_FOUND'; end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, v_po_item.unit_price);
    if v_qty <= 0 then raise exception 'RECEIVED_QUANTITY_MUST_BE_POSITIVE'; end if;
    if v_unit_cost < 0 then raise exception 'UNIT_COST_MUST_NOT_BE_NEGATIVE'; end if;

    v_remaining := v_po_item.quantity - v_po_item.received_quantity;
    if v_qty > v_remaining then
      raise exception 'RECEIPT_EXCEEDS_REMAINING: remaining %, requested %', v_remaining, v_qty;
    end if;

    insert into public.purchase_receipt_items(receipt_id, purchase_order_item_id, product_id, quantity, unit_cost)
    values (v_receipt_id, v_po_item.id, v_po_item.product_id, v_qty, v_unit_cost)
    returning id into v_receipt_item_id;

    insert into public.material_cost_layers(receipt_id, receipt_item_id, product_id, warehouse_id, quantity, unit_cost)
    values (v_receipt_id, v_receipt_item_id, v_po_item.product_id, p_warehouse_id, v_qty, v_unit_cost);

    select total_quantity, total_value
      into v_existing_qty, v_existing_value
    from public.material_costs
    where product_id = v_po_item.product_id
    for update;

    if not found then
      v_existing_qty := 0;
      v_existing_value := 0;
    end if;

    v_new_qty := v_existing_qty + v_qty;
    v_new_value := v_existing_value + (v_qty * v_unit_cost);

    insert into public.material_costs(product_id, average_unit_cost, last_unit_cost, total_quantity, total_value, last_receipt_id, updated_at)
    values (
      v_po_item.product_id,
      case when v_new_qty = 0 then 0 else v_new_value / v_new_qty end,
      v_unit_cost,
      v_new_qty,
      v_new_value,
      v_receipt_id,
      now()
    )
    on conflict (product_id) do update set
      average_unit_cost = excluded.average_unit_cost,
      last_unit_cost = excluded.last_unit_cost,
      total_quantity = excluded.total_quantity,
      total_value = excluded.total_value,
      last_receipt_id = excluded.last_receipt_id,
      updated_at = now();

    update public.purchase_order_items
    set received_quantity = received_quantity + v_qty
    where id = v_po_item.id;

    perform public.apply_stock_movement(
      v_po_item.product_id,
      p_warehouse_id,
      v_qty,
      'PURCHASE',
      'PURCHASE_RECEIPT',
      v_receipt_id,
      coalesce(p_receipt_date, now()),
      'Penerimaan ' || trim(p_receipt_number),
      false
    );
  end loop;

  select not exists (
    select 1 from public.purchase_order_items poi
    where poi.purchase_order_id = p_purchase_order_id
      and poi.received_quantity < poi.quantity
  ) into v_all_received;

  update public.purchase_orders
  set status = case when v_all_received then 'RECEIVED' else 'PARTIAL' end,
      updated_at = now()
  where id = p_purchase_order_id;

  return v_receipt_id;
end;
$$;

revoke all on function public.receive_purchase(uuid, uuid, text, timestamptz, text, jsonb) from public;
grant execute on function public.receive_purchase(uuid, uuid, text, timestamptz, text, jsonb) to authenticated;
