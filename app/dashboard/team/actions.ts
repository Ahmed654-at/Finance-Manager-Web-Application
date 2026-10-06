'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { readPayrollDetails, upsertPayrollRecord } from '@/lib/payroll'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  viewer: 'Viewer',
  employee: 'Employee',
}

const VALID_ROLES = ['owner', 'admin', 'accountant', 'viewer', 'employee'] as const
type Role = (typeof VALID_ROLES)[number]

function isValidRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value)
}

async function requireManager() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)

  return { supabase, user, companyId, role, canManage: role === 'owner' || role === 'admin' }
}

export async function addMember(formData: FormData) {
  const { supabase, companyId, role, canManage } = await requireManager()

  if (!canManage) {
    return { error: 'Permission denied.' }
  }

  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  const password = ((formData.get('password') as string | null) ?? '').trim()
  const requestedRole = (formData.get('role') as string | null) ?? 'viewer'
  const fullName = ((formData.get('full_name') as string | null) ?? '').trim()

  if (!fullName) {
    return { error: 'Full name is required.' }
  }

  if (!email) {
    return { error: 'Email is required.' }
  }

  if (!isValidRole(requestedRole)) {
    return { error: 'Invalid role selected.' }
  }

  if (requestedRole === 'owner' && role !== 'owner') {
    return { error: 'Only an owner can add another owner.' }
  }

  if (!supabaseAdmin) {
    return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY, so accounts cannot be added.' }
  }

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let matchedUserId = usersData?.users.find((candidate) => candidate.email?.toLowerCase() === email)?.id

  const accountAlreadyExisted = Boolean(matchedUserId)

  if (!matchedUserId) {
    // No account yet: create one with the password the owner/admin chose.
    if (password.length < 8) {
      return {
        error: 'No account exists for that email. Enter a password of at least 8 characters to create one.',
      }
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Shown as their name in the app (top bar, team list) instead of the email.
      user_metadata: { full_name: fullName, name: fullName, display_name: fullName },
    })

    if (createError || !created?.user) {
      return { error: createError?.message || 'Could not create the account.' }
    }

    matchedUserId = created.user.id
  }

  const { data: existingMembership } = await supabase
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', matchedUserId)
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    return { error: 'This person is already a team member.' }
  }

  const { error: insertError } = await supabase.from('company_members').insert({
    company_id: companyId,
    user_id: matchedUserId,
    role: requestedRole,
  })

  if (insertError) {
    return { error: 'Could not add team member.' }
  }

  // Optional payroll details: create (or update) the matching record on the Employees page.
  let payrollError: string | undefined
  let payrollSaved = false
  const payroll = readPayrollDetails(formData)

  if (payroll) {
    const displayName = fullName

    const result = await upsertPayrollRecord(
      supabase,
      companyId,
      email,
      displayName,
      payroll,
      ROLE_LABELS[requestedRole],
    )

    if (result.error) {
      payrollError = result.error
    } else {
      payrollSaved = true
    }
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/employees')
  return { success: true, accountAlreadyExisted, payrollSaved, payrollError }
}

export async function updateMemberRole(memberId: string, newRole: string) {
  const { supabase, user, companyId, role, canManage } = await requireManager()

  if (!canManage) {
    return { error: 'Permission denied.' }
  }

  if (!isValidRole(newRole)) {
    return { error: 'Invalid role selected.' }
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

  if ((targetMember.role === 'owner' || newRole === 'owner') && role !== 'owner') {
    return { error: 'Only an owner can change owner roles.' }
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

export async function resetMemberPassword(memberId: string, newPassword: string) {
  const { supabase, user, companyId, role, canManage } = await requireManager()

  if (!canManage) {
    return { error: 'Permission denied.' }
  }

  const password = newPassword.trim()
  if (password.length < 8) {
    return { error: 'The new password must be at least 8 characters.' }
  }

  if (!supabaseAdmin) {
    return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY, so passwords cannot be reset.' }
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
    return { error: 'Use "Change password" to change your own password.' }
  }

  if (targetMember.role === 'owner' && role !== 'owner') {
    return { error: 'Only an owner can reset another owner’s password.' }
  }

  // If this login also belongs to another company, resetting it would hand over access to that company too.
  const { count } = await supabaseAdmin
    .from('company_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetMember.user_id)

  if ((count ?? 0) > 1) {
    return {
      error:
        'This person belongs to more than one company, so their password cannot be reset from here. They can use "Forgot password" instead.',
    }
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetMember.user_id, { password })

  if (updateError) {
    return { error: updateError.message || 'Could not reset the password.' }
  }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user.id,
    action: 'password_reset',
    entity_type: 'company_member',
    entity_id: memberId,
    summary: 'Reset a team member’s password',
  })

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function removeMember(memberId: string) {
  const { supabase, user, companyId, role, canManage } = await requireManager()

  if (!canManage) {
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

  if (targetMember.user_id === user.id) {
    return { error: 'You cannot remove yourself.' }
  }

  if (targetMember.role === 'owner' && role !== 'owner') {
    return { error: 'Only an owner can remove another owner.' }
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
