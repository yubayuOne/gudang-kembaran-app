-- Optional demo data. Run after 001_initial_schema.sql in a development Supabase project.

insert into public.product_categories (name)
select 'Coffee' where not exists (select 1 from public.product_categories where name = 'Coffee');

insert into public.products (sku, name, category_id, product_type, unit)
select 'ESP-001', 'Espresso Blend', id, 'FINISHED_GOOD', 'Kg' from public.product_categories where name = 'Coffee'
on conflict (sku) do nothing;
insert into public.products (sku, name, category_id, product_type, unit)
select 'GB-ARA', 'Green Beans Arabica Gayo', id, 'RAW_MATERIAL', 'Kg' from public.product_categories where name = 'Coffee'
on conflict (sku) do nothing;
insert into public.products (sku, name, category_id, product_type, unit)
select 'GB-ROB', 'Green Beans Robusta Temanggung', id, 'RAW_MATERIAL', 'Kg' from public.product_categories where name = 'Coffee'
on conflict (sku) do nothing;

insert into public.warehouses (code, name)
values ('GK-GDG', 'Gudang Kembaran')
on conflict (code) do nothing;

insert into public.recipes (product_id, name, version, output_quantity, output_unit)
select p.id, 'Espresso Blend v2', 2, 1, 'Kg'
from public.products p where p.sku = 'ESP-001'
and not exists (select 1 from public.recipes r where r.product_id = p.id and r.version = 2);

insert into public.recipe_items (recipe_id, material_id, quantity, unit)
select r.id, p.id, 0.7, 'Kg'
from public.recipes r, public.products p where r.name = 'Espresso Blend v2' and p.sku = 'GB-ARA'
and not exists (select 1 from public.recipe_items i where i.recipe_id = r.id and i.material_id = p.id);
insert into public.recipe_items (recipe_id, material_id, quantity, unit)
select r.id, p.id, 0.35, 'Kg'
from public.recipes r, public.products p where r.name = 'Espresso Blend v2' and p.sku = 'GB-ROB'
and not exists (select 1 from public.recipe_items i where i.recipe_id = r.id and i.material_id = p.id);

insert into public.stock_balances (product_id, warehouse_id, quantity)
select p.id, w.id, case p.sku when 'GB-ARA' then 55 else 30 end
from public.products p cross join public.warehouses w
where p.sku in ('GB-ARA','GB-ROB')
on conflict (product_id, warehouse_id) do update set quantity = excluded.quantity, updated_at = now();
