'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

export async function createCategory(formData: FormData) {
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
  const type = String(formData.get('type') ?? '').trim()
  const normalizedType = type.toLowerCase()
  const description = String(formData.get('description') ?? '').trim()

  if (!name) {
    return { error: 'Category name is required.' }
  }

  if (normalizedType !== 'income' && normalizedType !== 'expense') {
    return { error: 'Please select a valid category type.' }
  }

  const { data: category, error: insertError } = await supabase
    .from('categories')
    .insert({
      company_id: companyId,
      name,
      type: normalizedType,
      description: description || null,
    })
    .select('id')
    .single()

  if (insertError || !category?.id) {
    return { error: insertError?.message || 'Could not create category. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'created',
    entityType: 'category',
    entityId: category.id,
    summary: `Created ${normalizedType} category "${name}"`,
  })

  revalidatePath('/dashboard/categories')
  redirect('/dashboard/categories')
}

export async function updateCategory(categoryId: string, formData: FormData) {
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
  const type = String(formData.get('type') ?? '').trim().toLowerCase()
  const description = String(formData.get('description') ?? '').trim()

  if (!name) {
    return { error: 'Category name is required.' }
  }

  if (type !== 'income' && type !== 'expense') {
    return { error: 'Please select a valid category type.' }
  }

  const { error: updateError } = await supabase
    .from('categories')
    .update({
      name,
      type,
      description: description || null,
    })
    .eq('id', categoryId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: updateError?.message || 'Could not update category. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'updated',
    entityType: 'category',
    entityId: categoryId,
    summary: `Updated ${type} category "${name}"`,
  })

  revalidatePath('/dashboard/categories')
  redirect('/dashboard/categories')
}

export async function deleteCategory(categoryId: string) {
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

  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', companyId)
    .eq('category_id', categoryId)
    .limit(1)

  if (existingTransactions && existingTransactions.length > 0) {
    return {
      error: 'Cannot delete category that is currently linked to transactions.',
    }
  }

  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: deleteError?.message || 'Could not delete category. Please try again.' }
  }

  await logAudit({
    companyId,
    userId: user.id,
    action: 'deleted',
    entityType: 'category',
    entityId: categoryId,
    summary: `Deleted category (${categoryId})`,
  })

  revalidatePath('/dashboard/categories')
  redirect('/dashboard/categories')
}
