'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()

  if (!name) {
    return { error: 'Customer name is required.' }
  }

  const { data: customer, error: insertError } = await supabase
    .from('customers')
    .insert({
      company_id: companyId,
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    })
    .select('id')
    .single()

  if (insertError || !customer?.id) {
    return { error: insertError?.message || 'Could not create customer. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'created',
    entityType: 'customer',
    entityId: customer.id,
    summary: `Added customer ${name}`,
  })

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()

  if (!name) {
    return { error: 'Customer name is required.' }
  }

  const { error: updateError } = await supabase
    .from('customers')
    .update({
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    })
    .eq('id', customerId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: updateError?.message || 'Could not update customer. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'updated',
    entityType: 'customer',
    entityId: customerId,
    summary: `Updated customer ${name}`,
  })

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .limit(1)
    .maybeSingle()

  if (existingInvoice) {
    return {
      error: 'Cannot delete a customer that has invoices. Delete or reassign those invoices first.',
    }
  }

  const { data: customerToDelete } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!customerToDelete) {
    return { error: 'Customer not found.' }
  }

  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: deleteError?.message || 'Could not delete customer. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'deleted',
    entityType: 'customer',
    entityId: customerId,
    summary: `Deleted customer "${customerToDelete.name}"`,
  })

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}
