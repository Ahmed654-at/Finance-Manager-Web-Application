'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function createCategory(formData: FormData) {
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
      company_id: membership.company_id,
      name,
      type: normalizedType,
      description: description || null,
    })
    .select('id')
    .single()

  if (insertError || !category?.id) {
    return { error: 'Could not create category. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
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
    .eq('company_id', membership.company_id)

  if (updateError) {
    return { error: 'Could not update category. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
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

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', membership.company_id)
    .eq('category_id', categoryId)
    .limit(1)
    .maybeSingle()

  if (existingTransactions) {
    return {
      error: 'Cannot delete a category that has transactions. Reassign or delete those transactions first.',
    }
  }

  const { data: categoryToDelete } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('id', categoryId)
    .eq('company_id', membership.company_id)
    .limit(1)
    .maybeSingle()

  if (!categoryToDelete) {
    return { error: 'Category not found.' }
  }

  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('company_id', membership.company_id)

  if (deleteError) {
    return { error: 'Could not delete category. Please try again.' }
  }

  await logAudit({
    companyId: membership.company_id,
    userId: user.id,
    action: 'deleted',
    entityType: 'category',
    entityId: categoryId,
    summary: `Deleted ${categoryToDelete.type} category "${categoryToDelete.name}"`,
  })

  revalidatePath('/dashboard/categories')
  redirect('/dashboard/categories')
}
