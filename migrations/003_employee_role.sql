-- ==============================================================================
-- 003: Employee role + expense approval workflow.
-- Run in the Supabase SQL editor AFTER 001_membership_rls.sql and 002_save_invoice.sql.
-- Safe to re-run. Does not delete any rows.
-- ==============================================================================

-- 1. Allow the 'employee' role on company_members.
alter table public.company_members drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner', 'admin', 'accountant', 'viewer', 'member', 'employee'));

-- 2. Expense requests: who submitted, what it is for, and the review outcome.
alter table public.team_expenses
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists purpose text check (purpose in ('project', 'marketing', 'other')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists idx_team_expenses_submitted_by on public.team_expenses(submitted_by);

-- 3. "Staff" = any member except employees. Employees must not read company financials.
create or replace function public.app_is_staff(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
      and role <> 'employee'
  );
$$;

-- 4. Company data is readable by staff only (employees are excluded).
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'services_and_products', 'employees', 'transactions',
    'salaries', 'customers', 'invoices', 'budgets'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.app_is_staff(company_id))', t || '_select', t);
  end loop;
end $$;

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_is_staff(i.company_id)));

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select using (public.app_is_staff(company_id));

-- 5. team_expenses: staff read all; an employee reads only their own requests.
drop policy if exists team_expenses_select on public.team_expenses;
create policy team_expenses_select on public.team_expenses
  for select using (public.app_is_staff(company_id) or submitted_by = auth.uid());

-- Writers create anything; an employee may only file their own PENDING request.
drop policy if exists team_expenses_insert on public.team_expenses;
create policy team_expenses_insert on public.team_expenses
  for insert with check (
    public.app_can_write(company_id)
    or (
      submitted_by = auth.uid()
      and status = 'pending'
      and public.app_is_member(company_id)
    )
  );
-- update / delete stay owner/admin/accountant only (from 001).
