-- Finance v10: invoice + payment + receivable ledger.
-- Safe to run repeatedly during development.

alter table public.invoices enable row level security;
alter table public.payments enable row level security;

DROP POLICY IF EXISTS "authenticated users can read invoices" ON public.invoices;
CREATE POLICY "authenticated users can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can manage invoices" ON public.invoices;
CREATE POLICY "authenticated users can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated users can read payments" ON public.payments;
CREATE POLICY "authenticated users can read payments" ON public.payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated users can create payments" ON public.payments;
CREATE POLICY "authenticated users can create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

create or replace function public.create_sales_invoice(p_sales_order_id uuid, p_due_date date default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_order public.sales_orders%rowtype; v_number text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_order from public.sales_orders where id=p_sales_order_id for update;
 if not found then raise exception 'SALES_ORDER_NOT_FOUND'; end if;
 if exists(select 1 from public.invoices where sales_order_id=p_sales_order_id) then raise exception 'INVOICE_ALREADY_EXISTS'; end if;
 v_number := 'INV-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0');
 while exists(select 1 from public.invoices where invoice_number=v_number) loop v_number := 'INV-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0'); end loop;
 insert into public.invoices(invoice_number,sales_order_id,customer_id,invoice_date,due_date,subtotal,discount,tax,total,paid_amount,status)
 values(v_number,v_order.id,v_order.customer_id,now(),p_due_date,v_order.subtotal,v_order.discount,v_order.tax,v_order.total,0,'UNPAID') returning id into v_id;
 return v_id;
end; $$;

create or replace function public.post_invoice_payment(p_invoice_id uuid,p_amount numeric,p_payment_method text,p_reference text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_invoice public.invoices%rowtype; v_payment uuid; v_number text; v_new_paid numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_amount is null or p_amount <= 0 then raise exception 'PAYMENT_AMOUNT_MUST_BE_POSITIVE'; end if;
 if nullif(trim(coalesce(p_payment_method,'')),'') is null then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
 select * into v_invoice from public.invoices where id=p_invoice_id for update;
 if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
 if v_invoice.status='PAID' then raise exception 'INVOICE_ALREADY_PAID'; end if;
 if p_amount > (v_invoice.total-v_invoice.paid_amount) then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
 v_number := 'PAY-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0');
 while exists(select 1 from public.payments where payment_number=v_number) loop v_number := 'PAY-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text,4,'0'); end loop;
 insert into public.payments(payment_number,invoice_id,payment_date,amount,payment_method,reference) values(v_number,p_invoice_id,now(),p_amount,upper(trim(p_payment_method)),nullif(trim(p_reference),'')) returning id into v_payment;
 v_new_paid := v_invoice.paid_amount + p_amount;
 update public.invoices set paid_amount=v_new_paid,status=case when v_new_paid >= total then 'PAID' else 'PARTIAL' end where id=p_invoice_id;
 return v_payment;
end; $$;

revoke all on function public.create_sales_invoice(uuid,date) from public;
grant execute on function public.create_sales_invoice(uuid,date) to authenticated;
revoke all on function public.post_invoice_payment(uuid,numeric,text,text) from public;
grant execute on function public.post_invoice_payment(uuid,numeric,text,text) to authenticated;
