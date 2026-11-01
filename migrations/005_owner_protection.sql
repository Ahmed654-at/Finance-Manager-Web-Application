-- ==============================================================================
-- 005: Only an owner may create, change or remove owner memberships.
-- The Team page already enforces this, but the database did not: any admin could call the
-- Supabase API directly and promote themselves (or anyone) to owner, or remove an owner.
-- Safe to run on an existing database (replaces three policies, touches no rows).
-- Run in the Supabase SQL editor.
-- ==============================================================================

create or replace function public.app_is_owner(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Admins add teammates, but only an owner can add another owner.
-- A user may still add themselves as owner of a company they just created.
drop policy if exists members_insert on public.company_members;
create policy members_insert on public.company_members
  for insert with check (
    (public.app_is_admin(company_id) and (role <> 'owner' or public.app_is_owner(company_id)))
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (select 1 from public.companies c where c.id = company_id and c.created_by = auth.uid())
      and not exists (select 1 from public.company_members m where m.company_id = company_members.company_id)
    )
  );

-- An admin cannot touch an owner's row, and cannot turn any row into an owner.
drop policy if exists members_update on public.company_members;
create policy members_update on public.company_members
  for update
  using (public.app_is_admin(company_id) and (role <> 'owner' or public.app_is_owner(company_id)))
  with check (public.app_is_admin(company_id) and (role <> 'owner' or public.app_is_owner(company_id)));

drop policy if exists members_delete on public.company_members;
create policy members_delete on public.company_members
  for delete using (public.app_is_admin(company_id) and (role <> 'owner' or public.app_is_owner(company_id)));
