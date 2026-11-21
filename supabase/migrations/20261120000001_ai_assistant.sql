-- المساعد الذكي (مساعد رصيد): عدّاد استخدام يومي لكل شركة + ملخص أرقام الشركة (بدون أسماء عملاء/موردين/تليفونات)
-- ملاحظة أمان: الأدمن بيقدر يقرا records كل الشركات (records_admin_read) فكل الاستعلامات هنا مقيّدة صراحةً بـ my_company().
-- المساعد متاح لمالك الشركة بس (company_role <> 'staff') لأنه بيعرض أرقام مالية.

create table if not exists public.ai_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (company_id, day)
);
alter table public.ai_usage enable row level security;   -- مفيش policies: الوصول من الدالة بس
revoke all on public.ai_usage from anon, authenticated;

-- هل المستخدم الحالي مالك/مدير نشط (مش موظف)؟
create or replace function public.ai_is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.status = 'active' and p.company_role is distinct from 'staff'
                   from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public.ai_is_owner() from public, anon;
grant execute on function public.ai_is_owner() to authenticated;

create or replace function public.ai_bump_usage(p_limit int default 40)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_co uuid; v_n int;
begin
  if not public.ai_is_owner() then return false; end if;
  select company_id into v_co from public.profiles where id = auth.uid();
  if v_co is null then return false; end if;
  insert into public.ai_usage(company_id, day, count) values (v_co, current_date, 1)
  on conflict (company_id, day) do update set count = public.ai_usage.count + 1
  returning count into v_n;
  return v_n <= p_limit;
end $$;
revoke all on function public.ai_bump_usage(int) from public, anon;
grant execute on function public.ai_bump_usage(int) to authenticated;

-- تحويل آمن لنص → رقم (records.data كلها jsonb ممكن تكون نصوص)
create or replace function public.ai_num(t text)
returns numeric language sql immutable set search_path = '' as $$
  select case when t ~ '^-?[0-9]+(\.[0-9]+)?$' then t::numeric else 0 end
$$;

create or replace function public.ai_business_summary(p_from date, p_to date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with
  r as (select tbl, id, data from public.records
        where company_id = (select public.my_company()) and public.ai_is_owner()),
  inr as (select * from r where left(coalesce(data->>'date',''),10) between p_from::text and p_to::text),
  sal  as (select id, public.ai_num(data->>'subtotal') sub, public.ai_num(data->>'total') tot,
                  public.ai_num(data->>'paid') paid, public.ai_num(data->>'vat_amount') vat from inr where tbl = 'sales'),
  pur  as (select public.ai_num(data->>'total') tot, public.ai_num(data->>'paid') paid from inr where tbl = 'purchases'),
  srt  as (select coalesce(sum(public.ai_num(data->>'total')),0) v from inr where tbl = 'sale_returns'),
  prt  as (select coalesce(sum(public.ai_num(data->>'total')),0) v from inr where tbl = 'purchase_returns'),
  rec  as (select coalesce(sum(public.ai_num(data->>'amount')),0) v from inr where tbl = 'payments' and data->>'kind' = 'receipt'),
  pay  as (select coalesce(sum(public.ai_num(data->>'amount')),0) v from inr where tbl = 'payments' and data->>'kind' = 'payment'),
  exq  as (select public.ai_num(e.data->>'amount') amt,
                  coalesce(nullif(a.data->>'name',''), 'بدون تصنيف') cat
           from inr e left join r a on a.tbl = 'accounts' and a.id = e.data->>'account_id'
           where e.tbl = 'expenses'),
  pr   as (select coalesce(sum(public.ai_num(data->>'total')),0) v from r
           where tbl = 'payroll_runs' and left(coalesce(data->>'month',''),7) between to_char(p_from,'YYYY-MM') and to_char(p_to,'YYYY-MM')),
  cogs as (select coalesce(sum(public.ai_num(l.data->>'qty') * public.ai_num(l.data->>'cost')),0) v
           from r l join sal s on s.id = l.data->>'sale_id' where l.tbl = 'sale_lines'),
  topp as (select coalesce(nullif(p.data->>'name',''), '—') name,
                  sum(public.ai_num(l.data->>'qty')) qty,
                  sum(public.ai_num(l.data->>'qty') * public.ai_num(l.data->>'unit_price')) revenue
           from r l join sal s on s.id = l.data->>'sale_id'
           left join r p on p.tbl = 'products' and p.id = l.data->>'product_id'
           where l.tbl = 'sale_lines' group by 1 order by 3 desc limit 5),
  prod as (select data from r where tbl = 'products'),
  low  as (select data->>'name' name, public.ai_num(data->>'qty') qty, public.ai_num(data->>'min_qty') min_qty
           from prod where public.ai_num(data->>'qty') <= public.ai_num(data->>'min_qty')
           order by public.ai_num(data->>'qty') limit 15),
  cust as (select public.ai_num(data->>'balance') b from r where tbl = 'customers'),
  supp as (select public.ai_num(data->>'balance') b from r where tbl = 'suppliers'),
  catg as (select cat, sum(amt) v from exq group by cat order by 2 desc limit 5)
  select case when not public.ai_is_owner() then null else jsonb_build_object(
    'from', p_from, 'to', p_to,
    'sales_net', (select coalesce(sum(sub),0) from sal),
    'sales_total_with_vat', (select coalesce(sum(tot),0) from sal),
    'sales_count', (select count(*) from sal),
    'sales_collected_at_invoice', (select coalesce(sum(paid),0) from sal),
    'vat_on_sales', (select coalesce(sum(vat),0) from sal),
    'sales_returns', (select v from srt),
    'purchases_total', (select coalesce(sum(tot),0) from pur),
    'purchases_count', (select count(*) from pur),
    'purchase_returns', (select v from prt),
    'receipts_from_customers', (select v from rec),
    'payments_to_suppliers', (select v from pay),
    'expenses_total', (select coalesce(sum(amt),0) from exq),
    'payroll_posted', (select v from pr),
    'cost_of_goods_sold_est', (select v from cogs),
    'gross_profit_est', (select coalesce(sum(sub),0) from sal) - (select v from srt) - (select v from cogs),
    'receivables_total', (select coalesce(sum(b),0) from cust where b > 0),
    'receivables_customers_count', (select count(*) from cust where b > 0),
    'payables_total', (select coalesce(sum(b),0) from supp where b > 0),
    'cash_in_registers', (select coalesce(sum(public.ai_num(data->>'balance')),0) from r where tbl = 'cash_registers'),
    'inventory_value_at_cost', (select coalesce(sum(public.ai_num(data->>'qty') * public.ai_num(data->>'cost')),0) from prod),
    'products_count', (select count(*) from prod),
    'low_stock_products', coalesce((select jsonb_agg(to_jsonb(low)) from low), '[]'::jsonb),
    'top_products_by_revenue', coalesce((select jsonb_agg(to_jsonb(topp)) from topp), '[]'::jsonb),
    'top_expense_categories', coalesce((select jsonb_agg(jsonb_build_object('category', cat, 'amount', v)) from catg), '[]'::jsonb)
  ) end
$$;
revoke all on function public.ai_business_summary(date, date) from public, anon;
grant execute on function public.ai_business_summary(date, date) to authenticated;
