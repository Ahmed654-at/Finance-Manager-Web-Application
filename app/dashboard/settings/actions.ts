'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'

export async function updateCompany(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)

  if (role !== 'owner' && role !== 'admin') {
    return { error: 'You do not have permission to edit company settings.' }
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const phone = (formData.get('phone') as string | null)?.trim() ?? ''
  const address = (formData.get('address') as string | null)?.trim() ?? ''
  const currency = (formData.get('currency') as string | null) ?? 'PKR'

  if (!name) {
    return { error: 'Company name is required.' }
  }

  const { error: updateError } = await supabase
    .from('companies')
    .update({
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      currency,
    })
    .eq('id', companyId)

  if (updateError) {
    return { error: 'Could not update company settings.' }
  }

  revalidatePath('/dashboard/settings')

  return { success: true }
}

export async function updateAccountProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const accountName = (formData.get('account_name') as string | null)?.trim() ?? ''
  if (!accountName) {
    return { error: 'Account name cannot be empty.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      full_name: accountName,
      name: accountName,
      display_name: accountName,
    },
  })

  if (updateError) {
    return { error: updateError.message || 'Could not update account profile.' }
  }

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/settings')

  return { success: true }
}
