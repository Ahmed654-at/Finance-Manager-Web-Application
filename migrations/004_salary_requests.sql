-- ==============================================================================
-- 004: Employee salary requests (approved by owner/admin -> salary expense).
-- Run in the Supabase SQL editor AFTER 001, 002 and 003. Safe to re-run.
-- ==============================================================================

create table if not exists public.salary_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text not null,
  payment_month text not null,            -- e.g. "October 2026"
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

create index if not exists idx_salary_requests_company on public.salary_requests(company_id);
create index if not exists idx_salary_requests_submitted_by on public.salary_requests(submitted_by);

alter table public.salary_requests enable row level security;

drop policy if exists salary_requests_select on public.salary_requests;
drop policy if exists salary_requests_insert on public.salary_requests;
drop policy if exists salary_requests_update on public.salary_requests;
drop policy if exists salary_requests_delete on public.salary_requests;

-- Staff see every request; an employee sees only their own.
create policy salary_requests_select on public.salary_requests
  for select using (public.app_is_staff(company_id) or submitted_by = auth.uid());

-- An employee may only file their own PENDING request; writers may create any.
create policy salary_requests_insert on public.salary_requests
  for insert with check (
    public.app_can_write(company_id)
    or (
      submitted_by = auth.uid()
      and status = 'pending'
      and public.app_is_member(company_id)
    )
  );

-- Only owner/admin review (approve/reject) or delete.
create policy salary_requests_update on public.salary_requests
  for update using (public.app_is_admin(company_id));
create policy salary_requests_delete on public.salary_requests
  for delete using (public.app_is_admin(company_id));
