'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

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
      company_id: membership.company_id,
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    })
    .select('id')
    .single()

  if (insertError || !customer?.id) {
    return { error: 'Could not create customer. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
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

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

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
    .eq('company_id', membership.company_id)

  if (updateError) {
    return { error: 'Could not update customer. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
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

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('company_id', membership.company_id)
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
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!customerToDelete) {
    return { error: 'Customer not found.' }
  }

  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('company_id', membership.company_id)

  if (deleteError) {
    return { error: 'Could not delete customer. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'deleted',
    entityType: 'customer',
    entityId: customerId,
    summary: `Deleted customer "${customerToDelete.name}"`,
  })

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}
