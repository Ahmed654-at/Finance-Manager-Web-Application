-- ==============================================================================
-- COMPANY FINANCE MANAGER - DATABASE SCHEMA (AI & PRODUCT COMPANY EDITION)
-- ==============================================================================
-- !!! WARNING: THIS SCRIPT DROPS AND RECREATES EVERY TABLE BELOW. ALL DATA IN THEM IS LOST. !!!
-- Use it ONLY for a brand-new / empty database (for example a new client's Supabase project).
--
-- Upgrading an existing database that already has data? Do NOT run this file.
-- Run the files in /migrations in order instead (001, 002, 003, 004). This file already
-- contains everything those migrations do.
--
-- Run this script in the Supabase SQL Editor. Roles: owner, admin, accountant, viewer, employee.
--   owner/admin  : full access, manage the team, approve expense and salary requests
--   accountant   : record and edit financial data
--   viewer       : read-only
--   employee     : sees ONLY their own expense and salary requests
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "pgcrypto";

-- Clean up existing tables to allow fresh setup
drop table if exists public.salary_requests cascade;
drop table if exists public.invoice_items cascade;
drop table if exists public.invoices cascade;
drop table if exists public.customers cascade;
drop table if exists public.salaries cascade;
drop table if exists public.team_expenses cascade;
drop table if exists public.employees cascade;
drop table if exists public.services_and_products cascade;
drop table if exists public.transactions cascade;
drop table if exists public.budgets cascade;
drop table if exists public.categories cascade;
drop table if exists public.accounts cascade;
drop table if exists public.notifications cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.company_members cascade;
drop table if exists public.companies cascade;
drop table if exists public.user_settings cascade;

-- 2. Companies Table (one company per organisation; each new account gets its own)
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Company Finance',
  currency text not null default 'USD',
  email text,
  phone text,
  address text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 3. Company Members Table (Staff & System Roles)
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' not null
    constraint company_members_role_check
    check (role in ('owner', 'admin', 'accountant', 'viewer', 'member', 'employee')),
  created_at timestamptz default now() not null,
  unique(company_id, user_id)
);

-- 4. Financial Accounts Table (Cash, Bank, Credit, Savings)
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'credit', 'savings')),
  opening_balance numeric(15, 2) default 0.00 not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 5. Categories Table (Income & Expense categories)
-- Standard categories are seeded automatically by the application (see lib/company.ts).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  description text,
  created_at timestamptz default now() not null
);

-- 6. Products & AI Services Catalog Table
create table public.services_and_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('product', 'ai_service')),
  price numeric(15, 2) not null check (price >= 0),
  billing_type text default 'one_off' not null check (billing_type in ('one_off', 'monthly', 'hourly', 'project')),
  description text,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 7. Employees Table (Payroll profiles; linked to a login by matching email)
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  designation text not null,
  department text not null default 'AI Services',
  salary_amount numeric(15, 2) not null check (salary_amount >= 0),
  status text default 'active' not null check (status in ('active', 'on_leave', 'terminated')),
  payment_method text default 'bank_transfer' not null check (payment_method in ('bank_transfer', 'cash', 'cheque', 'crypto')),
  bank_account_details text,
  hire_date date default current_date not null,
  created_at timestamptz default now() not null
);

-- 8. Transactions Table (Financial Ledger)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(15, 2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  revenue_stream text check (revenue_stream in ('ai_services', 'product_sales', 'other')),
  expense_type text check (expense_type in ('salary', 'team_expense', 'infrastructure', 'operational', 'other')),
  employee_id uuid references public.employees(id) on delete set null,
  service_id uuid references public.services_and_products(id) on delete set null,
  description text,
  transaction_date date not null,
  reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 9. Salaries Table (Payroll Disbursements)
create table public.salaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  employee_id uuid references public.employees(id) on delete cascade not null,
  amount numeric(15, 2) not null check (amount > 0),
  bonus numeric(15, 2) default 0.00 not null,
  deductions numeric(15, 2) default 0.00 not null,
  net_amount numeric(15, 2) not null check (net_amount > 0),
  payment_date date not null,
  payment_month text not null,
  status text default 'paid' not null check (status in ('pending', 'paid')),
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz default now() not null
);

-- 10. Team Expenses Table (Claims & Reimbursements; employees file these as 'pending')
create table public.team_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  amount numeric(15, 2) not null check (amount > 0),
  expense_date date not null,
  purpose text check (purpose in ('project', 'marketing', 'other')),
  status text default 'approved' not null check (status in ('pending', 'approved', 'reimbursed', 'rejected')),
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  receipt_url text,
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now() not null
);

-- 11. Salary Requests Table (employee asks for a salary; owner/admin approves -> salary expense)
create table public.salary_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text not null,
  payment_month text not null,
  amount numeric(15, 2) not null check (amount > 0),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now() not null
);

-- 12. Customers Table (Clients / Buyers)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz default now() not null
);

-- 13. Invoices Table (Billing & Receivables)
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  invoice_number text not null,
  service_type text default 'ai_service' not null check (service_type in ('ai_service', 'product_sale', 'general')),
  issue_date date not null,
  due_date date,
  subtotal numeric(15, 2) default 0.00 not null,
  tax numeric(15, 2) default 0.00 not null,
  total numeric(15, 2) default 0.00 not null,
  status text default 'draft' not null check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz default now() not null
);

-- 14. Invoice Items Table (Line Items)
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(10, 2) default 1 not null,
  unit_price numeric(15, 2) default 0.00 not null,
  amount numeric(15, 2) default 0.00 not null,
  created_at timestamptz default now() not null
);

-- 15. Budgets Table (Category Spending Limits)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  name text not null,
  amount numeric(15, 2) not null check (amount > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz default now() not null
);

-- 16. Notifications Table (In-app Alerts)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- 17. Audit Logs Table (Activity Tracking)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index idx_company_members_company on public.company_members(company_id);
create index idx_company_members_user on public.company_members(user_id);
create index idx_accounts_company on public.accounts(company_id);
create index idx_categories_company on public.categories(company_id);
create index idx_services_products_company on public.services_and_products(company_id);
create index idx_employees_company on public.employees(company_id);
create index idx_transactions_company on public.transactions(company_id);
create index idx_transactions_date on public.transactions(transaction_date);
create index idx_transactions_category on public.transactions(category_id);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_stream on public.transactions(revenue_stream);
create index idx_transactions_expense_type on public.transactions(expense_type);
create index idx_salaries_company on public.salaries(company_id);
create index idx_salaries_employee on public.salaries(employee_id);
create index idx_team_expenses_company on public.team_expenses(company_id);
create index idx_team_expenses_submitted_by on public.team_expenses(submitted_by);
create index idx_salary_requests_company on public.salary_requests(company_id);
create index idx_salary_requests_submitted_by on public.salary_requests(submitted_by);
create index idx_customers_company on public.customers(company_id);
create index idx_invoices_company on public.invoices(company_id);
create index idx_invoices_customer on public.invoices(customer_id);
create index idx_invoice_items_invoice on public.invoice_items(invoice_id);
create index idx_budgets_company on public.budgets(company_id);
create index idx_notifications_company on public.notifications(company_id);
create index idx_notifications_user on public.notifications(user_id);
create index idx_audit_logs_company on public.audit_logs(company_id);

-- ==============================================================================
-- ROLE HELPER FUNCTIONS (SECURITY DEFINER so policies on company_members do not recurse)
-- ==============================================================================
create or replace function public.app_is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
  );
$$;

-- Any member except employees: may read company financial data.
create or replace function public.app_is_staff(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid() and role <> 'employee'
  );
$$;

create or replace function public.app_can_write(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
      and role in ('owner', 'admin', 'accountant')
  );
$$;

create or replace function public.app_is_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.services_and_products enable row level security;
alter table public.employees enable row level security;
alter table public.transactions enable row level security;
alter table public.salaries enable row level security;
alter table public.team_expenses enable row level security;
alter table public.salary_requests enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.budgets enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- companies
create policy companies_select on public.companies
  for select using (public.app_is_member(id) or created_by = auth.uid());
create policy companies_insert on public.companies
  for insert with check (created_by = auth.uid());
create policy companies_update on public.companies
  for update using (public.app_is_admin(id));

-- company_members
create policy members_select on public.company_members
  for select using (public.app_is_member(company_id) or user_id = auth.uid());
-- Admins add teammates; a user may add themselves as owner of a company they just created.
create policy members_insert on public.company_members
  for insert with check (
    public.app_is_admin(company_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (select 1 from public.companies c where c.id = company_id and c.created_by = auth.uid())
      and not exists (select 1 from public.company_members m where m.company_id = company_members.company_id)
    )
  );
create policy members_update on public.company_members
  for update using (public.app_is_admin(company_id));
create policy members_delete on public.company_members
  for delete using (public.app_is_admin(company_id));

-- Standard company-scoped tables: staff read, owner/admin/accountant write. Employees see none of these.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'services_and_products', 'employees', 'transactions',
    'salaries', 'customers', 'invoices', 'budgets'
  ]
  loop
    execute format('create policy %I on public.%I for select using (public.app_is_staff(company_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.app_can_write(company_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.app_can_write(company_id)) with check (public.app_can_write(company_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.app_can_write(company_id))', t || '_delete', t);
  end loop;
end $$;

-- invoice_items: scoped through the parent invoice.
create policy invoice_items_select on public.invoice_items
  for select using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_is_staff(i.company_id)));
create policy invoice_items_insert on public.invoice_items
  for insert with check (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));
create policy invoice_items_update on public.invoice_items
  for update using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));
create policy invoice_items_delete on public.invoice_items
  for delete using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));

-- team_expenses: staff read all; an employee reads only their own and may only file their own PENDING request.
create policy team_expenses_select on public.team_expenses
  for select using (public.app_is_staff(company_id) or submitted_by = auth.uid());
create policy team_expenses_insert on public.team_expenses
  for insert with check (
    public.app_can_write(company_id)
    or (submitted_by = auth.uid() and status = 'pending' and public.app_is_member(company_id))
  );
create policy team_expenses_update on public.team_expenses
  for update using (public.app_can_write(company_id)) with check (public.app_can_write(company_id));
create policy team_expenses_delete on public.team_expenses
  for delete using (public.app_can_write(company_id));

-- salary_requests: same rule; only owner/admin review or delete.
create policy salary_requests_select on public.salary_requests
  for select using (public.app_is_staff(company_id) or submitted_by = auth.uid());
create policy salary_requests_insert on public.salary_requests
  for insert with check (
    public.app_can_write(company_id)
    or (submitted_by = auth.uid() and status = 'pending' and public.app_is_member(company_id))
  );
create policy salary_requests_update on public.salary_requests
  for update using (public.app_is_admin(company_id));
create policy salary_requests_delete on public.salary_requests
  for delete using (public.app_is_admin(company_id));

-- notifications: users read/update their own; any member may create one for the company.
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_insert on public.notifications
  for insert with check (public.app_is_member(company_id));
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- audit_logs: staff read; members append entries as themselves; no edits or deletes.
create policy audit_select on public.audit_logs
  for select using (public.app_is_staff(company_id));
create policy audit_insert on public.audit_logs
  for insert with check (public.app_is_member(company_id) and user_id = auth.uid());

-- ==============================================================================
-- save_invoice: atomic invoice create/update with numeric-safe totals.
-- Runs as the calling user (SECURITY INVOKER), so the policies above apply.
-- ==============================================================================
create or replace function public.save_invoice(
  p_invoice_id uuid,          -- null = create, otherwise update this draft invoice
  p_company_id uuid,
  p_customer_id uuid,
  p_invoice_number text,
  p_service_type text,
  p_issue_date date,
  p_due_date date,
  p_notes text,
  p_tax numeric,
  p_items jsonb               -- [{ "description": "...", "quantity": 1, "unit_price": 10 }]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_subtotal numeric(15, 2);
  v_tax numeric(15, 2) := round(coalesce(p_tax, 0), 2);
  v_status text;
begin
  if v_tax < 0 then
    raise exception 'Tax cannot be negative.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one line item is required.';
  end if;

  -- Each line amount is rounded to cents, then summed, so totals always match the lines.
  select coalesce(sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as i;

  if p_invoice_id is null then
    insert into invoices (
      company_id, customer_id, invoice_number, service_type, issue_date, due_date,
      subtotal, tax, total, status, notes
    ) values (
      p_company_id, p_customer_id, p_invoice_number, coalesce(p_service_type, 'ai_service'),
      coalesce(p_issue_date, current_date), p_due_date,
      v_subtotal, v_tax, v_subtotal + v_tax, 'draft', p_notes
    )
    returning id into v_id;
  else
    select status into v_status
      from invoices where id = p_invoice_id and company_id = p_company_id
      for update;

    if not found then
      raise exception 'Invoice not found.';
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft invoices can be edited.';
    end if;

    update invoices set
      customer_id = p_customer_id,
      invoice_number = p_invoice_number,
      issue_date = coalesce(p_issue_date, current_date),
      due_date = p_due_date,
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax,
      notes = p_notes
    where id = p_invoice_id and company_id = p_company_id
    returning id into v_id;

    if v_id is null then
      raise exception 'You do not have permission to edit this invoice.';
    end if;

    delete from invoice_items where invoice_id = v_id;
  end if;

  insert into invoice_items (invoice_id, description, quantity, unit_price, amount)
  select
    v_id,
    i->>'description',
    (i->>'quantity')::numeric,
    round((i->>'unit_price')::numeric, 2),
    round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)
  from jsonb_array_elements(p_items) as i;

  return jsonb_build_object('id', v_id, 'subtotal', v_subtotal, 'tax', v_tax, 'total', v_subtotal + v_tax);
end;
$$;

grant execute on function public.save_invoice(uuid, uuid, uuid, text, text, date, date, text, numeric, jsonb)
  to authenticated;
