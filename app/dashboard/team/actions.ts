'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_ROLES = ['admin', 'accountant', 'viewer'] as const

export async function addMember(formData: FormData) {
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
    return { error: 'Permission denied.' }
  }

  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  const requestedRole = (formData.get('role') as string | null) ?? 'viewer'

  if (!VALID_ROLES.includes(requestedRole as (typeof VALID_ROLES)[number])) {
    return { error: 'Invalid role selected.' }
  }

  if (!supabaseAdmin) {
    return { error: 'Permission denied.' }
  }

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
  const matchedUser = usersData?.users.find((candidate) => candidate.email?.toLowerCase() === email)

  if (!matchedUser) {
    return { error: 'No account found with that email. They need to sign up first.' }
  }

  const { data: existingMembership } = await supabase
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', matchedUser.id)
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    return { error: 'This person is already a team member.' }
  }

  const { error: insertError } = await supabase.from('company_members').insert({
    company_id: companyId,
    user_id: matchedUser.id,
    role: requestedRole,
  })

  if (insertError) {
    return { error: 'Could not add team member.' }
  }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function updateMemberRole(memberId: string, newRole: string) {
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
    return { error: 'Permission denied.' }
  }

  if (newRole === 'owner') {
    return { error: 'Owner transfer is not supported.' }
  }

  const { data: targetMember } = await supabase
    .from('company_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!targetMember) {
    return { error: 'Member not found.' }
  }

  if (targetMember.user_id === user.id) {
    return { error: 'You cannot change your own role.' }
  }

  if (targetMember.role === 'owner' || newRole === 'owner') {
    return { error: 'Owner role cannot be changed here.' }
  }

  if (!VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return { error: 'Invalid role selected.' }
  }

  const { error: updateError } = await supabase
    .from('company_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: 'Could not update member role.' }
  }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function removeMember(memberId: string) {
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
    return { error: 'Permission denied.' }
  }

  const { data: targetMember } = await supabase
    .from('company_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (!targetMember) {
    return { error: 'Member not found.' }
  }

  if (targetMember.role === 'owner') {
    return { error: 'Cannot remove the company owner.' }
  }

  if (targetMember.user_id === user.id) {
    return { error: 'You cannot remove yourself.' }
  }

  const { error: deleteError } = await supabase
    .from('company_members')
    .delete()
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (deleteError) {
    return { error: 'Could not remove member.' }
  }

  revalidatePath('/dashboard/team')
  return { success: true }
}
