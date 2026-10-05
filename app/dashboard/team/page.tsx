import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { addMember, removeMember, resetMemberPassword, updateMemberRole } from './actions'
import DeleteConfirmButton from '../components/DeleteConfirmButton'

type ActionResult = { error?: string; success?: boolean } | undefined

function back(result: ActionResult, successMessage: string): never {
  if (result?.error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/dashboard/team?success=${encodeURIComponent(successMessage)}`)
}

async function handleAddMember(formData: FormData) {
  'use server'
  const result = await addMember(formData)

  if (result && 'error' in result && result.error) {
    back(result, '')
  }

  const ok = result && 'accountAlreadyExisted' in result ? result : undefined
  const parts = [
    ok?.accountAlreadyExisted
      ? 'Added. This email already had an account, so its existing password still applies (the password you typed was not used).'
      : 'Account created and added. Share the password you entered with this person.',
  ]

  if (ok?.payrollSaved) parts.push('Payroll record saved on the Employees page.')
  if (ok?.payrollError) parts.push(`The login was added, but the payroll record failed: ${ok.payrollError}`)

  back(result, parts.join(' '))
}

async function handleUpdateMemberRole(formData: FormData) {
  'use server'
  const memberId = (formData.get('memberId') as string | null) ?? ''
  const newRole = (formData.get('role') as string | null) ?? 'viewer'
  back(await updateMemberRole(memberId, newRole), 'Role updated.')
}

async function handleResetPassword(formData: FormData) {
  'use server'
  const memberId = (formData.get('memberId') as string | null) ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  back(
    await resetMemberPassword(memberId, password),
    'Password reset. Share the new password with that person.',
  )
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  viewer: 'Viewer',
  employee: 'Employee',
  member: 'Member',
}

const ROLE_HELP =
  'Owner/Admin: full access and team management. Accountant: can record and edit finances. Viewer: read-only. Employee: can only submit their own expense requests for approval.'

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
}) {
  const params = (await searchParams) ?? {}

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)

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
  const isOwner = role === 'owner'
  const assignableRoles = isOwner
    ? ['owner', 'admin', 'accountant', 'viewer', 'employee']
    : ['admin', 'accountant', 'viewer', 'employee']

  return (
    <main className="px-4 pb-10 pt-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          {params.error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {params.error}
            </p>
          )}
          {params.success && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {params.success}
            </p>
          )}

          {canManage && (
            <form action={handleAddMember} className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Add account</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email
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
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password <span className="font-normal text-slate-500">(new accounts only)</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="text"
                    minLength={8}
                    autoComplete="off"
                    placeholder="min 8 characters"
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
                    defaultValue="employee"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  Payroll details <span className="font-normal text-slate-500">(optional)</span>
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Fill these in to also create their record on the Employees page, so you only enter a person once.
                  Leave them all empty to add a login only.
                </p>

                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="full_name" className="block text-xs font-medium text-slate-700">
                      Full name
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      placeholder="e.g. Alex Johnson"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="designation" className="block text-xs font-medium text-slate-700">
                      Designation
                    </label>
                    <input
                      id="designation"
                      name="designation"
                      type="text"
                      placeholder="e.g. Senior AI Engineer"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="department" className="block text-xs font-medium text-slate-700">
                      Department
                    </label>
                    <select
                      id="department"
                      name="department"
                      defaultValue="AI Services"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option>AI Services</option>
                      <option>Product Engineering</option>
                      <option>Marketing &amp; Sales</option>
                      <option>Operations</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="salary_amount" className="block text-xs font-medium text-slate-700">
                      Monthly salary
                    </label>
                    <input
                      id="salary_amount"
                      name="salary_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 5000"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="payment_method" className="block text-xs font-medium text-slate-700">
                      Payment method
                    </label>
                    <select
                      id="payment_method"
                      name="payment_method"
                      defaultValue="bank_transfer"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="crypto">Crypto</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bank_account_details" className="block text-xs font-medium text-slate-700">
                      Bank / payment details
                    </label>
                    <input
                      id="bank_account_details"
                      name="bank_account_details"
                      type="text"
                      placeholder="IBAN / Bank / Account #"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                If the email already has an account it is simply added. Otherwise an account is created with the
                password above, which you then share with that person.
              </p>
              <p className="text-xs text-slate-500">{ROLE_HELP}</p>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
              >
                Add account
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
                const canEditMember =
                  canManage && member.user_id !== user.id && (member.role !== 'owner' || isOwner)

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {member.email}
                          {member.user_id === user.id && (
                            <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Role: {ROLE_LABELS[member.role] ?? member.role}
                        </p>
                      </div>

                      {canEditMember ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <form action={handleUpdateMemberRole} className="flex items-center gap-2">
                            <input type="hidden" name="memberId" value={member.id} />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                            >
                              {assignableRoles.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
                            >
                              Update role
                            </button>
                          </form>

                          <DeleteConfirmButton
                            label="Remove"
                            confirmText={`Remove ${member.email} from the team? They will lose access.`}
                            action={async () => {
                              'use server'
                              back(await removeMember(member.id), 'Member removed.')
                            }}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:border-red-400 hover:bg-red-100 transition-colors duration-200 motion-reduce:transition-none"
                          />
                        </div>
                      ) : null}
                    </div>

                    {canEditMember && (
                      <form
                        action={handleResetPassword}
                        className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center"
                      >
                        <input type="hidden" name="memberId" value={member.id} />
                        <input
                          name="password"
                          type="text"
                          minLength={8}
                          required
                          autoComplete="off"
                          placeholder="New password (min 8 characters)"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none sm:max-w-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
                        >
                          Reset password
                        </button>
                      </form>
                    )}
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
