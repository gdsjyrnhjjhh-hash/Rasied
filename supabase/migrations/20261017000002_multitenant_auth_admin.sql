-- ============================================================================
-- نظام التجارة — تعدد الشركات (Multi-tenant) + حسابات بالتليفون + إدارة + تتبّع الاستخدام
-- كل مستخدم = شركة مستقلة معزولة بالكامل عبر RLS. أول مسجّل = أدمن.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- الجداول ----------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  profile     jsonb not null default '{}'::jsonb,   -- هاتف/عنوان/رقم ضريبي/نسبة الضريبة/العملة
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  phone              text not null unique,
  full_name          text not null,
  company_id         uuid not null references public.companies(id) on delete cascade,
  role               text not null default 'user'   check (role in ('admin','user')),
  status             text not null default 'active' check (status in ('active','suspended')),
  status_note        text,
  status_changed_at  timestamptz,
  login_count        integer not null default 0,
  last_login_at      timestamptz,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index profiles_company_idx on public.profiles(company_id);

create table public.activity_days (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  hits     integer not null default 1,
  primary key (user_id, day)
);

create table public.login_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  at          timestamptz not null default now(),
  user_agent  text
);
create index login_events_user_idx on public.login_events(user_id, at desc);

-- بيانات الشركة التشغيلية (عملاء/فواتير/أصناف/قيود… كل جداول النظام) — معزولة بـ company_id
create table public.records (
  company_id  uuid not null references public.companies(id) on delete cascade,
  id          text not null,
  tbl         text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (company_id, id)
);
create index records_company_tbl_idx on public.records(company_id, tbl, created_at desc);

-- ---------- دوال مساعدة (تُستخدم في سياسات RLS) ----------
create function public.my_company() returns uuid
language sql stable security definer set search_path = '' as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false)
$$;

revoke all on function public.my_company(), public.is_admin(), public.is_active() from public, anon;
grant execute on function public.my_company(), public.is_admin(), public.is_active() to authenticated;

-- ---------- RLS ----------
alter table public.companies     enable row level security;
alter table public.profiles      enable row level security;
alter table public.activity_days enable row level security;
alter table public.login_events  enable row level security;
alter table public.records       enable row level security;

revoke all on public.companies, public.profiles, public.activity_days, public.login_events, public.records from anon;

-- profiles: يقرأ المستخدم ملفه، والأدمن يقرأ الجميع. التعديل عبر دوال RPC فقط.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- companies
create policy companies_select on public.companies for select to authenticated
  using (id = (select public.my_company()) or (select public.is_admin()));
create policy companies_update on public.companies for update to authenticated
  using (id = (select public.my_company()) and (select public.is_active()))
  with check (id = (select public.my_company()));

-- records: عزل كامل بين الشركات + المستخدم الموقوف لا يصل لشيء
create policy records_tenant on public.records for all to authenticated
  using (company_id = (select public.my_company()) and (select public.is_active()))
  with check (company_id = (select public.my_company()) and (select public.is_active()));
create policy records_admin_read on public.records for select to authenticated
  using ((select public.is_admin()));

-- سجلات النشاط: قراءة فقط (للمستخدم نفسه أو الأدمن)
create policy activity_select on public.activity_days for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy logins_select on public.login_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------- تسجيل النشاط ----------
create function public.record_login(p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.login_events(user_id, user_agent) values (auth.uid(), left(p_ua, 300));
  update public.profiles
     set login_count = login_count + 1, last_login_at = now(), last_seen_at = now()
   where id = auth.uid();
  insert into public.activity_days(user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Riyadh')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;

create function public.heartbeat() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
  insert into public.activity_days(user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Riyadh')::date)
  on conflict (user_id, day) do update set hits = public.activity_days.hits + 1;
end $$;

-- ---------- دوال الأدمن ----------
create function public.admin_users() returns table (
  id uuid, phone text, full_name text, role text, status text, status_note text,
  created_at timestamptz, company_id uuid, company_name text,
  login_count integer, last_login_at timestamptz, last_seen_at timestamptz,
  days_used bigint, records_count bigint, last_record_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select p.id, p.phone, p.full_name, p.role, p.status, p.status_note,
         p.created_at, p.company_id, c.name,
         p.login_count, p.last_login_at, p.last_seen_at,
         (select count(*) from public.activity_days a where a.user_id = p.id),
         (select count(*) from public.records r where r.company_id = p.company_id),
         (select max(r.created_at) from public.records r where r.company_id = p.company_id)
    from public.profiles p
    join public.companies c on c.id = p.company_id
   order by p.created_at desc;
end $$;

create function public.admin_company_tables(p_company uuid) returns table (tbl text, n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select r.tbl, count(*), max(r.created_at) from public.records r
   where r.company_id = p_company group by r.tbl order by r.tbl;
end $$;

create function public.admin_set_status(p_user uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'bad status'; end if;
  if p_user = auth.uid() then raise exception 'cannot change your own status'; end if;
  update public.profiles
     set status = p_status, status_note = p_note, status_changed_at = now()
   where id = p_user;
end $$;

-- ---------- إنشاء حساب (تستدعيه Edge Function بمفتاح الخدمة فقط) ----------
create function public.create_account(p_uid uuid, p_phone text, p_name text, p_company text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_role text;
begin
  perform pg_advisory_xact_lock(7001);   -- يمنع سباق "أول مسجّل"
  v_role := case when exists (select 1 from public.profiles) then 'user' else 'admin' end;
  insert into public.companies(name, profile)
  values (p_company, jsonb_build_object('phone', p_phone, 'vat_rate', 14, 'vat_enabled', true, 'currency', 'ج.م'))
  returning id into v_company;
  insert into public.profiles(id, phone, full_name, company_id, role)
  values (p_uid, p_phone, p_name, v_company, v_role);
  return v_role;
end $$;

revoke all on function public.create_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_account(uuid, text, text, text) to service_role;

revoke all on function public.record_login(text), public.heartbeat(),
  public.admin_users(), public.admin_company_tables(uuid), public.admin_set_status(uuid, text, text)
  from public, anon;
grant execute on function public.record_login(text), public.heartbeat(),
  public.admin_users(), public.admin_company_tables(uuid), public.admin_set_status(uuid, text, text)
  to authenticated;
