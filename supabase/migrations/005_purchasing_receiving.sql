-- Purchasing v8: purchase orders + receiving into inventory.
-- Safe to run repeatedly during development.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  supplier_id uuid not null references public.suppliers(id),
  warehouse_id uuid not null references public.warehouses(id),
  order_date timestamptz not null default now(),
  expected_date date,
  status text not null default 'DRAFT',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  received_quantity numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0
);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  purchase_order_id uuid not null references public.purchase_orders(id),
  warehouse_id uuid not null references public.warehouses(id),
  receipt_date timestamptz not null default now(),
  status text not null default 'POSTED',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items(id),
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null default 0
);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

DROP POLICY IF EXISTS "authenticated users can read purchase orders" ON public.purchase_orders;
CREATE POLICY "authenticated users can read purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "authenticated users can manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read purchase order items" ON public.purchase_order_items;
CREATE POLICY "authenticated users can read purchase order items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can manage purchase order items" ON public.purchase_order_items;
CREATE POLICY "authenticated users can manage purchase order items" ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read purchase receipts" ON public.purchase_receipts;
CREATE POLICY "authenticated users can read purchase receipts" ON public.purchase_receipts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can create purchase receipts" ON public.purchase_receipts;
CREATE POLICY "authenticated users can create purchase receipts" ON public.purchase_receipts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read purchase receipt items" ON public.purchase_receipt_items;
CREATE POLICY "authenticated users can read purchase receipt items" ON public.purchase_receipt_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can create purchase receipt items" ON public.purchase_receipt_items;
CREATE POLICY "authenticated users can create purchase receipt items" ON public.purchase_receipt_items FOR INSERT TO authenticated WITH CHECK (true);

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
  v_qty numeric;
  v_remaining numeric;
  v_total_received numeric;
  v_all_received boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_purchase_order_id is null or p_warehouse_id is null then raise exception 'PURCHASE_ORDER_AND_WAREHOUSE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_receipt_number, '')), '') is null then raise exception 'RECEIPT_NUMBER_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'RECEIPT_ITEMS_REQUIRED'; end if;

  if exists (select 1 from public.purchase_receipts where receipt_number = trim(p_receipt_number)) then
    raise exception 'RECEIPT_NUMBER_EXISTS';
  end if;

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
    if v_qty <= 0 then raise exception 'RECEIVED_QUANTITY_MUST_BE_POSITIVE'; end if;

    v_remaining := v_po_item.quantity - v_po_item.received_quantity;
    if v_qty > v_remaining then
      raise exception 'RECEIPT_EXCEEDS_REMAINING: remaining %, requested %', v_remaining, v_qty;
    end if;

    insert into public.purchase_receipt_items(receipt_id, purchase_order_item_id, product_id, quantity, unit_cost)
    values (v_receipt_id, v_po_item.id, v_po_item.product_id, v_qty, coalesce((v_item->>'unit_cost')::numeric, v_po_item.unit_price));

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
