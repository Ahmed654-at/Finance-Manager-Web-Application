-- ==============================================================================
-- 002: Atomic invoice save (create or update) with numeric-safe totals.
-- Runs as the calling user (SECURITY INVOKER), so the RLS policies from 001 apply.
-- The whole function is one transaction: if anything fails, nothing is saved.
-- Run in the Supabase SQL editor after 001_membership_rls.sql.
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
