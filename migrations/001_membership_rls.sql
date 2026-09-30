-- ==============================================================================
-- 001: Replace "any authenticated user" RLS policies with company-membership RLS.
-- Safe to run on an existing database (does not drop tables or delete rows).
-- Run in the Supabase SQL editor. The service-role key (cron) bypasses RLS.
-- ==============================================================================

-- Helper functions (SECURITY DEFINER so policies on company_members don't recurse).
create or replace function public.app_is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
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

-- Drop the old permissive policies.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies', 'company_members', 'accounts', 'categories', 'services_and_products',
        'employees', 'transactions', 'salaries', 'team_expenses', 'customers', 'invoices',
        'invoice_items', 'budgets', 'notifications', 'audit_logs'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

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

-- Standard company-scoped tables: members read, owner/admin/accountant write.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'services_and_products', 'employees', 'transactions',
    'salaries', 'team_expenses', 'customers', 'invoices', 'budgets'
  ]
  loop
    execute format('create policy %I on public.%I for select using (public.app_is_member(company_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.app_can_write(company_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.app_can_write(company_id)) with check (public.app_can_write(company_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.app_can_write(company_id))', t || '_delete', t);
  end loop;
end $$;

-- invoice_items: scoped through the parent invoice.
create policy invoice_items_select on public.invoice_items
  for select using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_is_member(i.company_id)));
create policy invoice_items_insert on public.invoice_items
  for insert with check (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));
create policy invoice_items_update on public.invoice_items
  for update using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));
create policy invoice_items_delete on public.invoice_items
  for delete using (exists (
    select 1 from public.invoices i where i.id = invoice_id and public.app_can_write(i.company_id)));

-- notifications: users read/update their own; any member may create one for the company.
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_insert on public.notifications
  for insert with check (public.app_is_member(company_id));
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- audit_logs: members read; members append entries as themselves; no edits/deletes.
create policy audit_select on public.audit_logs
  for select using (public.app_is_member(company_id));
create policy audit_insert on public.audit_logs
  for insert with check (public.app_is_member(company_id) and user_id = auth.uid());
