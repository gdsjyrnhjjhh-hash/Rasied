-- [قديم — غير مستخدم] استُبدل بـ 20261017000002_multitenant_auth_admin.sql (جدول records المعزول لكل شركة)
-- Trading System core schema (Supabase)
-- شغّل من SQL Editor عند الربط الفعلي

create extension if not exists "pgcrypto";

-- مثال جداول أساسية — وسّع حسب SEED في js/db.js
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  balance numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  balance numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  unit text,
  cost numeric default 0,
  price numeric default 0,
  qty numeric default 0,
  min_qty numeric default 0,
  warehouse_id uuid references warehouses(id),
  created_at timestamptz default now()
);

create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  balance numeric default 0,
  location text,
  created_at timestamptz default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  job_title text,
  phone text,
  salary numeric default 0,
  hire_date date,
  status text default 'active',
  created_at timestamptz default now()
);

-- أكمل بقية الجداول (sales, purchases, journal_*, payroll_*) بنفس الأسلوب عند التفعيل
