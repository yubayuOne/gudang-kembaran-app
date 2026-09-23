-- Sales v9: sales order + delivery posting into inventory.
-- Safe to run repeatedly during development.

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;

DROP POLICY IF EXISTS "authenticated users can read sales orders" ON public.sales_orders;
CREATE POLICY "authenticated users can read sales orders" ON public.sales_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can manage sales orders" ON public.sales_orders;
CREATE POLICY "authenticated users can manage sales orders" ON public.sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read sales order items" ON public.sales_order_items;
CREATE POLICY "authenticated users can read sales order items" ON public.sales_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can manage sales order items" ON public.sales_order_items;
CREATE POLICY "authenticated users can manage sales order items" ON public.sales_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read deliveries" ON public.deliveries;
CREATE POLICY "authenticated users can read deliveries" ON public.deliveries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can create deliveries" ON public.deliveries;
CREATE POLICY "authenticated users can create deliveries" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read delivery items" ON public.delivery_items;
CREATE POLICY "authenticated users can read delivery items" ON public.delivery_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can create delivery items" ON public.delivery_items;
CREATE POLICY "authenticated users can create delivery items" ON public.delivery_items FOR INSERT TO authenticated WITH CHECK (true);

create or replace function public.post_sales_delivery(
  p_sales_order_id uuid,
  p_warehouse_id uuid,
  p_delivery_number text,
  p_delivery_date timestamptz,
  p_courier text,
  p_tracking_number text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_item jsonb;
  v_so_item public.sales_order_items%rowtype;
  v_qty numeric;
  v_delivered numeric;
  v_remaining numeric;
  v_all_delivered boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_sales_order_id is null or p_warehouse_id is null then raise exception 'SALES_ORDER_AND_WAREHOUSE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_delivery_number, '')), '') is null then raise exception 'DELIVERY_NUMBER_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'DELIVERY_ITEMS_REQUIRED'; end if;

  if exists (select 1 from public.deliveries where delivery_number = trim(p_delivery_number)) then
    raise exception 'DELIVERY_NUMBER_EXISTS';
  end if;

  insert into public.deliveries(delivery_number, sales_order_id, customer_id, delivery_date, status, courier, tracking_number, notes)
  select trim(p_delivery_number), so.id, so.customer_id, coalesce(p_delivery_date, now()), 'POSTED',
         nullif(trim(p_courier), ''), nullif(trim(p_tracking_number), ''), nullif(trim(p_notes), '')
  from public.sales_orders so
  where so.id = p_sales_order_id
  returning id into v_delivery_id;

  if v_delivery_id is null then raise exception 'SALES_ORDER_NOT_FOUND'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_so_item
    from public.sales_order_items
    where id = (v_item->>'sales_order_item_id')::uuid
      and sales_order_id = p_sales_order_id
    for update;

    if not found then raise exception 'SALES_ORDER_ITEM_NOT_FOUND'; end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_qty <= 0 then raise exception 'DELIVERED_QUANTITY_MUST_BE_POSITIVE'; end if;

    select coalesce(sum(di.quantity), 0) into v_delivered
    from public.delivery_items di
    join public.deliveries d on d.id = di.delivery_id
    where d.sales_order_id = p_sales_order_id
      and di.product_id = v_so_item.product_id;

    v_remaining := v_so_item.quantity - v_delivered;
    if v_qty > v_remaining then
      raise exception 'DELIVERY_EXCEEDS_REMAINING: remaining %, requested %', v_remaining, v_qty;
    end if;

    insert into public.delivery_items(delivery_id, product_id, quantity)
    values (v_delivery_id, v_so_item.product_id, v_qty);

    perform public.apply_stock_movement(
      v_so_item.product_id,
      p_warehouse_id,
      -v_qty,
      'SALE',
      'DELIVERY',
      v_delivery_id,
      coalesce(p_delivery_date, now()),
      'Pengiriman ' || trim(p_delivery_number),
      false
    );
  end loop;

  select not exists (
    select 1
    from public.sales_order_items soi
    where soi.sales_order_id = p_sales_order_id
      and soi.quantity > (
        select coalesce(sum(di.quantity), 0)
        from public.delivery_items di
        join public.deliveries d on d.id = di.delivery_id
        where d.sales_order_id = p_sales_order_id
          and di.product_id = soi.product_id
      )
  ) into v_all_delivered;

  update public.sales_orders
  set status = case when v_all_delivered then 'DELIVERED' else 'READY' end
  where id = p_sales_order_id;

  return v_delivery_id;
end;
$$;

revoke all on function public.post_sales_delivery(uuid, uuid, text, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.post_sales_delivery(uuid, uuid, text, timestamptz, text, text, text, jsonb) to authenticated;
