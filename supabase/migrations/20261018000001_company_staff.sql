-- مستخدمو الشركة (موظفون) وصلاحياتهم — إضافة فقط، لا تغيّر شيئًا في الحسابات القائمة (كلها owner)
alter table public.profiles add column if not exists company_role text not null default 'owner' check (company_role in ('owner','staff'));
alter table public.profiles add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists created_by uuid;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select company_role = 'owner' from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- تعديل بيانات الشركة للمالك فقط
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (id = (select public.my_company()) and (select public.is_active()) and (select public.is_owner()))
  with check (id = (select public.my_company()));

-- قائمة موظفي شركتي (للمالك فقط)
create or replace function public.company_staff() returns table (
  id uuid, phone text, full_name text, status text, status_note text, permissions jsonb,
  login_count integer, last_login_at timestamptz, last_seen_at timestamptz, created_at timestamptz, days_used bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_owner() and public.is_active()) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select p.id, p.phone, p.full_name, p.status, p.status_note, p.permissions,
         p.login_count, p.last_login_at, p.last_seen_at, p.created_at,
         (select count(*) from public.activity_days a where a.user_id = p.id)
    from public.profiles p
   where p.company_id = public.my_company() and p.company_role = 'staff'
   order by p.created_at desc;
end $$;

-- تعديل موظف (اسم / صلاحيات / إيقاف-تفعيل) — المالك على موظفي شركته فقط
create or replace function public.staff_update(p_user uuid, p_name text, p_permissions jsonb, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_owner() and public.is_active()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'bad status'; end if;
  if jsonb_typeof(p_permissions) <> 'array' then raise exception 'bad permissions'; end if;
  update public.profiles
     set full_name = coalesce(nullif(trim(p_name), ''), full_name),
         permissions = p_permissions,
         status = p_status, status_note = p_note, status_changed_at = now()
   where id = p_user and company_id = public.my_company() and company_role = 'staff';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

-- إنشاء ملف موظف (تستدعيها Edge Function بمفتاح الخدمة فقط)
create or replace function public.create_staff(p_uid uuid, p_company uuid, p_phone text, p_name text, p_permissions jsonb, p_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, phone, full_name, company_id, role, company_role, permissions, created_by)
  values (p_uid, p_phone, p_name, p_company, 'user', 'staff', coalesce(p_permissions, '[]'::jsonb), p_by);
end $$;

revoke all on function public.create_staff(uuid, uuid, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_staff(uuid, uuid, text, text, jsonb, uuid) to service_role;
revoke all on function public.company_staff(), public.staff_update(uuid, text, jsonb, text, text) from public, anon;
grant execute on function public.company_staff(), public.staff_update(uuid, text, jsonb, text, text) to authenticated;
