'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateCompany(formData: FormData) {
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
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const companyId = membership.company_id
  const role = membership.role || 'member'

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
