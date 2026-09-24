import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { addMember, removeMember, updateMemberRole } from './actions'

async function handleAddMember(formData: FormData) {
  'use server'
  await addMember(formData)
  return
}

async function handleUpdateMemberRole(formData: FormData) {
  'use server'
  const memberId = (formData.get('memberId') as string | null) ?? ''
  const newRole = (formData.get('role') as string | null) ?? 'viewer'
  await updateMemberRole(memberId, newRole)
  return
}

async function handleRemoveMember(formData: FormData) {
  'use server'
  const memberId = (formData.get('memberId') as string | null) ?? ''
  await removeMember(memberId)
  return
}

export default async function TeamPage() {
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

  const { data: teamRows } = await supabase
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  const teamMembers = teamRows ?? []

  const memberDetails = await Promise.all(
    teamMembers.map(async (member) => {
      let email = 'Unknown user'

      if (supabaseAdmin) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
        email = userData?.user?.email ?? email
      }

      return {
        ...member,
        email,
      }
    }),
  )

  const canManage = role === 'owner' || role === 'admin'

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          {canManage && (
            <form action={handleAddMember} className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1.5fr_0.8fr]">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Add team member by email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    defaultValue="viewer"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Add member
              </button>
            </form>
          )}

          {memberDetails.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No team members yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberDetails.map((member) => {
                const canEditMember = canManage && member.user_id !== user.id && member.role !== 'owner'

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{member.email}</p>
                        <p className="mt-1 text-sm text-slate-600">Role: {member.role}</p>
                      </div>

                      {canManage && member.user_id !== user.id && member.role !== 'owner' ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <form action={handleUpdateMemberRole} className="flex items-center gap-2">
                            <input type="hidden" name="memberId" value={member.id} />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                            >
                              <option value="admin">Admin</option>
                              <option value="accountant">Accountant</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              Update role
                            </button>
                          </form>

                          <form action={handleRemoveMember}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
