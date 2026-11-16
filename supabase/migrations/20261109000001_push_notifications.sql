-- ============================================================================
-- إشعارات الهاتف (Web Push) — رصيد
-- إضافي فقط: جداول ودوال جديدة، لا يمس أي جدول موجود.
-- ============================================================================

-- 1) اشتراكات الأجهزة (جهاز المستخدم + مفاتيح التشفير). لا وصول مباشر: عبر دوال RPC و service_role فقط.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  company_id   uuid not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  prefs        jsonb not null default '{}'::jsonb,   -- {"cheque":false,...,"os":false} الأنواع المعطّلة
  ua           text,
  fail_count   int  not null default 0,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

-- 2) سجل المُرسَل (لعدم تكرار نفس التنبيه خلال 6 أيام)
create table if not exists public.push_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_log enable row level security;

-- 3) إعداد سرّي (مفاتيح VAPID + سرّ الجدولة) — صف واحد، لا وصول إلا service_role
create table if not exists public.push_config (
  id           int primary key default 1 check (id = 1),
  vapid_public  text,
  vapid_private text,
  subject      text not null default 'mailto:support@rasied.pages.dev',
  cron_secret  text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
alter table public.push_config enable row level security;
insert into public.push_config(id) values (1) on conflict (id) do nothing;

revoke all on public.push_subscriptions, public.push_log, public.push_config from anon, authenticated;

-- 4) أدوات مساعدة
create or replace function public.push_num(t text) returns numeric
language sql immutable set search_path = '' as $$
  select case when t ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then trim(t)::numeric else 0 end
$$;

create or replace function public.push_money(n numeric) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(to_char(coalesce(n, 0), 'FM999,999,999,999,990.99'), '\.$', '')
$$;

-- 5) واجهات المستخدم (تتطلب حسابًا نشطًا)
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select vapid_public from public.push_config where id = 1
$$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null, p_prefs jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'not allowed'; end if;
  -- نقبل خدمات الدفع المعروفة فقط (حماية من توجيه الخادم إلى عناوين عشوائية)
  if p_endpoint is null or length(p_endpoint) > 1000 or p_endpoint !~
     '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  then raise exception 'unsupported push endpoint'; end if;
  if p_p256dh is null or p_auth is null or length(p_p256dh) > 200 or length(p_auth) > 100 then raise exception 'bad keys'; end if;

  insert into public.push_subscriptions(user_id, company_id, endpoint, p256dh, auth, ua, prefs)
  values (auth.uid(), public.my_company(), p_endpoint, p_p256dh, p_auth, left(p_ua, 300), coalesce(p_prefs, '{}'::jsonb))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, company_id = excluded.company_id, p256dh = excluded.p256dh, auth = excluded.auth,
        ua = excluded.ua, prefs = excluded.prefs, fail_count = 0, last_seen_at = now();

  delete from public.push_subscriptions
   where id in (select id from public.push_subscriptions where user_id = auth.uid() order by last_seen_at desc offset 10);
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

revoke all on function public.push_public_key() from public, anon;
revoke all on function public.push_subscribe(text, text, text, text, jsonb) from public, anon;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_public_key() to authenticated;
grant execute on function public.push_subscribe(text, text, text, text, jsonb) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;

-- 6) حساب التنبيهات لمستخدم (للخادم فقط): يحترم الصلاحيات وتفضيلات الجهاز ولا يُعيد ما أُرسل مؤخرًا
create or replace function public.push_user_alerts(p_user uuid)
returns table(akey text, atype text, asev text, atitle text, abody text, ahref text)
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid; v_owner boolean; v_perms jsonb; v_prefs jsonb;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  c_chq boolean; c_ins boolean; c_stock boolean; c_quote boolean; c_follow boolean; c_credit boolean;
begin
  select p.company_id, (p.company_role = 'owner'), coalesce(p.permissions, '[]'::jsonb)
    into v_company, v_owner, v_perms
    from public.profiles p where p.id = p_user and p.status = 'active';
  if v_company is null then return; end if;

  select s.prefs into v_prefs from public.push_subscriptions s where s.user_id = p_user order by s.last_seen_at desc limit 1;
  v_prefs := coalesce(v_prefs, '{}'::jsonb);
  if v_prefs->>'os' = 'false' then return; end if;

  c_chq    := (v_owner or v_perms @> '"cheques"'::jsonb)       and coalesce(v_prefs->>'cheque', 'true')      <> 'false';
  c_ins    := (v_owner or v_perms @> '"installments"'::jsonb)  and coalesce(v_prefs->>'installment', 'true') <> 'false';
  c_stock  := (v_owner or v_perms @> '"products"'::jsonb)      and coalesce(v_prefs->>'stock', 'true')       <> 'false';
  c_quote  := (v_owner or v_perms @> '"quotes"'::jsonb)        and coalesce(v_prefs->>'quote', 'true')       <> 'false';
  c_follow := (v_owner or v_perms @> '"field-reports"'::jsonb) and coalesce(v_prefs->>'followup', 'true')    <> 'false';
  c_credit := (v_owner or v_perms @> '"customers"'::jsonb)     and coalesce(v_prefs->>'credit', 'true')      <> 'false';

  return query
  with a as (
    -- الشيكات: واردة (portfolio/deposited) وصادرة (pending) متأخرة أو خلال 3 أيام
    select 'chq:' || c.id || ':' || case when x.d < 0 then 'late' when x.d = 0 then 'today' else 'soon' end as akey,
           'cheque'::text as atype,
           (case when x.d < 0 then 'danger' when x.d = 0 then 'warn' else 'info' end)::text as asev,
           (case when c.data->>'dir' = 'in' then 'شيك وارد ' else 'شيك صادر ' end ||
            case when x.d < 0 then 'متأخر ' || (-x.d) || ' يوم' when x.d = 0 then 'يستحق اليوم' else 'يستحق بعد ' || x.d || ' يوم' end) as atitle,
           (coalesce(pn.data->>'name', '—') || ' — ' || public.push_money(public.push_num(c.data->>'amount')) ||
            coalesce(' — رقم ' || nullif(c.data->>'cheque_no', ''), '')) as abody,
           'cheques.html'::text as ahref
      from public.records c
      cross join lateral (select case when c.data->>'due_date' ~ '^\d{4}-\d{2}-\d{2}$' then (c.data->>'due_date')::date - v_today end as d) x
      left join public.records pn on pn.company_id = v_company
           and pn.tbl = case when c.data->>'dir' = 'in' then 'customers' else 'suppliers' end and pn.id = c.data->>'party_id'
     where c_chq and c.company_id = v_company and c.tbl = 'cheques' and x.d is not null and x.d <= 3
       and ((c.data->>'dir' = 'in' and c.data->>'status' in ('portfolio', 'deposited')) or (c.data->>'dir' = 'out' and c.data->>'status' = 'pending'))
    union all
    -- الأقساط غير المسددة: متأخرة أو اليوم أو غدًا
    select 'ins:' || i.id || ':' || case when x.d < 0 then 'late' when x.d = 0 then 'today' else 'tomorrow' end,
           'installment'::text,
           (case when x.d < 0 then 'danger' when x.d = 0 then 'warn' else 'info' end)::text,
           'قسط ' || case when x.d < 0 then 'متأخر ' || (-x.d) || ' يوم' when x.d = 0 then 'يستحق اليوم' else 'يستحق غدًا' end,
           coalesce(pl.data->>'party_name', '—') || ' — القسط ' || coalesce(i.data->>'no', '') || ' — ' ||
             public.push_money(public.push_num(i.data->>'amount') - pd.paid),
           'installments.html'::text
      from public.records i
      cross join lateral (select case when i.data->>'due_date' ~ '^\d{4}-\d{2}-\d{2}$' then (i.data->>'due_date')::date - v_today end as d) x
      cross join lateral (select coalesce(sum(public.push_num(p.data->>'amount')), 0) as paid from public.records p
                           where p.company_id = v_company and p.tbl = 'payments' and p.data->>'installment_id' = i.id) pd
      left join public.records pl on pl.company_id = v_company and pl.tbl = 'installment_plans' and pl.id = i.data->>'plan_id'
     where c_ins and i.company_id = v_company and i.tbl = 'installments' and x.d is not null and x.d <= 1
       and public.push_num(i.data->>'amount') - pd.paid > 0.004
    union all
    -- المخزون: أصناف وصلت حد الطلب
    select 'stock:' || s.n || ':' || s.z, 'stock'::text, (case when s.z > 0 then 'danger' else 'warn' end)::text,
           s.n || ' صنف وصل لحد الطلب' || case when s.z > 0 then ' (' || s.z || ' نفد)' else '' end,
           s.names || case when s.n > 3 then ' وغيرها' else '' end, 'products.html'::text
      from (select count(*) as n, count(*) filter (where low.q <= 0) as z,
                   string_agg(low.nm, '، ' order by low.rn) filter (where low.rn <= 3) as names
              from (select p.data->>'name' as nm, public.push_num(p.data->>'qty') as q,
                           row_number() over (order by p.data->>'name') as rn
                      from public.records p
                     where c_stock and p.company_id = v_company and p.tbl = 'products'
                       and public.push_num(p.data->>'min_qty') > 0
                       and public.push_num(p.data->>'qty') <= public.push_num(p.data->>'min_qty')) low) s
     where s.n > 0
    union all
    -- عروض الأسعار التي تنتهي خلال يومين
    select 'quote:' || q.ids, 'quote'::text, 'info'::text, q.n || ' عرض سعر ينتهي خلال يومين', q.names, 'quotes.html'::text
      from (select count(*) as n, string_agg(r.id, ',' order by r.id) as ids,
                   string_agg('#' || coalesce(r.data->>'number', '') || ' ' || coalesce(r.data->>'party_name', ''), '، ' order by r.id) as names
              from public.records r
             where c_quote and r.company_id = v_company and r.tbl = 'quotes' and r.data->>'status' in ('draft', 'sent')
               and r.data->>'valid_until' ~ '^\d{4}-\d{2}-\d{2}$'
               and (r.data->>'valid_until')::date between v_today and v_today + 2) q
     where q.n > 0
    union all
    -- متابعات الزيارات والمكالمات المستحقة (للموظف: تقاريره فقط)
    select 'follow:' || f.n || ':' || v_today, 'followup'::text, (case when f.late then 'warn' else 'info' end)::text,
           f.n || ' متابعة مستحقة', f.names, 'field-reports.html'::text
      from (select count(*) as n, bool_or((r.data->>'follow_date')::date < v_today) as late,
                   string_agg(coalesce(r.data->>'party_name', ''), '، ' order by r.id) as names
              from public.records r
             where c_follow and r.company_id = v_company and r.tbl = 'visit_reports'
               and r.data->>'follow_date' ~ '^\d{4}-\d{2}-\d{2}$' and (r.data->>'follow_date')::date <= v_today
               and coalesce(r.data->>'follow_done', 'false') <> 'true'
               and (v_owner or r.data->>'by' = p_user::text)) f
     where f.n > 0
    union all
    -- العملاء الذين تجاوزوا حد الائتمان
    select 'credit:' || cr.ids, 'credit'::text, 'warn'::text, cr.n || ' عميل تجاوز حد الائتمان', cr.names, 'customers.html'::text
      from (select count(*) as n, string_agg(r.id, ',' order by r.id) as ids, string_agg(coalesce(r.data->>'name', ''), '، ' order by r.id) as names
              from public.records r
             where c_credit and r.company_id = v_company and r.tbl = 'customers'
               and public.push_num(r.data->>'credit_limit') > 0
               and public.push_num(r.data->>'balance') > public.push_num(r.data->>'credit_limit')) cr
     where cr.n > 0
  )
  select a.akey, a.atype, a.asev, a.atitle, a.abody, a.ahref from a
   where not exists (select 1 from public.push_log l where l.user_id = p_user and l.key = a.akey and l.sent_at > now() - interval '6 days');
end $$;

create or replace function public.push_mark_sent(p_user uuid, p_keys text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_log(user_id, key) select p_user, unnest(p_keys)
  on conflict (user_id, key) do update set sent_at = now();
  delete from public.push_log where sent_at < now() - interval '30 days';
end $$;

revoke all on function public.push_user_alerts(uuid) from public, anon, authenticated;
revoke all on function public.push_mark_sent(uuid, text[]) from public, anon, authenticated;
grant execute on function public.push_user_alerts(uuid) to service_role;
grant execute on function public.push_mark_sent(uuid, text[]) to service_role;
