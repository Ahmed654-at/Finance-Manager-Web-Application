'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'

export async function createServiceOrProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Permission denied.' }
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const type = (formData.get('type') as string) || 'ai_service'
  const price = parseFloat((formData.get('price') as string) || '0')
  const billingType = (formData.get('billing_type') as string) || 'one_off'
  const description = (formData.get('description') as string | null)?.trim() || null

  if (!name || isNaN(price) || price < 0) {
    return { error: 'Valid name and price are required.' }
  }

  const { error } = await supabase.from('services_and_products').insert({
    company_id: companyId,
    name,
    type,
    price,
    billing_type: billingType,
    description,
    is_active: true,
  })

  if (error) {
    return { error: error.message || 'Could not save product or AI service.' }
  }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: 'created',
    entity_type: 'service_or_product',
    summary: `Created ${type === 'ai_service' ? 'AI Service' : 'Product'} "${name}" at ${price}`,
  })

  revalidatePath('/dashboard/services')
  return { success: true }
}

export async function recordRevenueFromCatalog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin' && role !== 'accountant') {
    return { error: 'Permission denied.' }
  }

  const serviceId = formData.get('service_id') as string
  const amount = parseFloat((formData.get('amount') as string) || '0')
  const date = (formData.get('date') as string | null) || new Date().toISOString().slice(0, 10)
  const accountId = (formData.get('account_id') as string | null) || null
  const reference = (formData.get('reference') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!serviceId || amount <= 0) {
    return { error: 'Please choose an item and specify a valid amount.' }
  }

  // Fetch service/product details
  const { data: item } = await supabase
    .from('services_and_products')
    .select('*')
    .eq('id', serviceId)
    .eq('company_id', companyId)
    .single()

  if (!item) return { error: 'Item not found in catalog.' }

  const stream = item.type === 'ai_service' ? 'ai_services' : 'product_sales'

  // Find corresponding category
  let categoryId: string | null = null
  const keyword = item.type === 'ai_service' ? '%AI Service%' : '%Product%'
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', keyword)
    .limit(1)
    .maybeSingle()

  if (cat) categoryId = cat.id

  // 1. Create income transaction
  const description = `${item.type === 'ai_service' ? 'AI Service Revenue' : 'Product Sale'}: ${item.name}${notes ? ` - ${notes}` : ''}`
  
  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      type: 'income',
      revenue_stream: stream,
      amount,
      category_id: categoryId,
      account_id: accountId,
      service_id: serviceId,
      description,
      transaction_date: date,
      reference: reference || `REV-${item.type === 'ai_service' ? 'AI' : 'PROD'}-${Date.now().toString().slice(-5)}`,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (txError) {
    return { error: txError.message || 'Could not record transaction.' }
  }

  // 2. Update account balance
  if (accountId) {
    const { data: acc } = await supabase.from('accounts').select('opening_balance').eq('id', accountId).single()
    if (acc) {
      await supabase
        .from('accounts')
        .update({ opening_balance: Number(acc.opening_balance || 0) + amount })
        .eq('id', accountId)
    }
  }

  // 3. Audit Log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: 'created',
    entity_type: 'transaction',
    summary: `Logged ${stream} income of ${amount} for "${item.name}"`,
  })

  revalidatePath('/dashboard/services')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteServiceOrProduct(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Permission denied.' }
  }

  const { error } = await supabase
    .from('services_and_products')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: error.message || 'Could not delete item.' }
  }

  revalidatePath('/dashboard/services')
  return { success: true }
}
