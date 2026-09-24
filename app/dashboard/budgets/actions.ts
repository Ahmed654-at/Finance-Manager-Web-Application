'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function createBudget(formData: FormData) {
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
  const categoryId = String(formData.get('category_id') ?? '').trim()
  const amountValue = Number(formData.get('amount'))
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()

  if (!name) {
    return { error: 'Budget name is required.' }
  }

  if (!categoryId) {
    return { error: 'Please select a category.' }
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: 'Amount must be a positive number.' }
  }

  if (!startDate) {
    return { error: 'Start date is required.' }
  }

  if (!endDate) {
    return { error: 'End date is required.' }
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { error: 'End date cannot be before start date.' }
  }

  const { data: budget, error: insertError } = await supabase
    .from('budgets')
    .insert({
      company_id: membership.company_id,
      category_id: categoryId,
      name,
      amount: amountValue,
      start_date: startDate,
      end_date: endDate,
    })
    .select('id')
    .single()

  if (insertError || !budget?.id) {
    return { error: 'Could not create budget. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'created',
    entityType: 'budget',
    entityId: budget.id,
    summary: `Created budget "${name}" of ${amountValue}`,
  })

  revalidatePath('/dashboard/budgets')
  redirect('/dashboard/budgets')
}

export async function updateBudget(budgetId: string, formData: FormData) {
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
  const categoryId = String(formData.get('category_id') ?? '').trim()
  const amountValue = Number(formData.get('amount'))
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()

  if (!name) {
    return { error: 'Budget name is required.' }
  }

  if (!categoryId) {
    return { error: 'Please select a category.' }
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: 'Amount must be a positive number.' }
  }

  if (!startDate) {
    return { error: 'Start date is required.' }
  }

  if (!endDate) {
    return { error: 'End date is required.' }
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { error: 'End date cannot be before start date.' }
  }

  const { error: updateError } = await supabase
    .from('budgets')
    .update({
      category_id: categoryId,
      name,
      amount: amountValue,
      start_date: startDate,
      end_date: endDate,
    })
    .eq('id', budgetId)
    .eq('company_id', membership.company_id)

  if (updateError) {
    return { error: 'Could not update budget. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'updated',
    entityType: 'budget',
    entityId: budgetId,
    summary: `Updated budget "${name}" of ${amountValue}`,
  })

  revalidatePath('/dashboard/budgets')
  redirect('/dashboard/budgets')
}

export async function deleteBudget(budgetId: string) {
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

  const { data: budgetToDelete } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('id', budgetId)
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!budgetToDelete) {
    return { error: 'Budget not found.' }
  }

  const { error: deleteError } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('company_id', membership.company_id)

  if (deleteError) {
    return { error: 'Could not delete budget. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'deleted',
    entityType: 'budget',
    entityId: budgetId,
    summary: `Deleted budget "${budgetToDelete.name}"`,
  })

  revalidatePath('/dashboard/budgets')
  redirect('/dashboard/budgets')
}
