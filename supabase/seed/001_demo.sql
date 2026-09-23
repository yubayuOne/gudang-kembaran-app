insert into public.products (sku,name,product_type,unit) values
('GB-ARA','Green Bean Arabica Gayo','RAW_MATERIAL','Kg',10),
('GB-ROB','Green Bean Robusta Temanggung','RAW_MATERIAL','Kg',10),
('ESP-001','Espresso Blend','FINISHED_GOOD','Kg',5),
('KBP-001','Kopi Bubuk Premium','FINISHED_GOOD','Kg',5)
on conflict (sku) do nothing;

insert into public.stock_balances(product_id,quantity)
select id, case sku when 'GB-ARA' then 55 when 'GB-ROB' then 30 when 'ESP-001' then 12 else 0 end
from public.products where sku in ('GB-ARA','GB-ROB','ESP-001','KBP-001')
on conflict (product_id) do update set quantity=excluded.quantity;

insert into public.stock_movements(product_id,movement_type,quantity,notes)
select id,'IN',55,'Saldo awal demo' from public.products where sku='GB-ARA';
insert into public.stock_movements(product_id,movement_type,quantity,notes)
select id,'IN',30,'Saldo awal demo' from public.products where sku='GB-ROB';
insert into public.stock_movements(product_id,movement_type,quantity,notes)
select id,'IN',12,'Saldo awal demo' from public.products where sku='ESP-001';
