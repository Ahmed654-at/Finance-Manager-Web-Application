import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { addMember, removeMember, resetMemberPassword, updateMemberRole } from './actions'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import ResetPasswordButton from './ResetPasswordButton'
import { buttonDanger, buttonPrimary, buttonSecondary } from '../components/buttonStyles'

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
  const confirmPassword = (formData.get('confirm_password') as string | null) ?? ''
  // The panel checks this in the browser too; this guards against a bypassed check.
  if (password !== confirmPassword) {
    back({ error: 'The new password and its confirmation do not match.' }, '')
  }
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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none'

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
      let name: string | null = null

      if (supabaseAdmin) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
        email = userData?.user?.email ?? email
        const meta = userData?.user?.user_metadata ?? {}
        const candidate = meta.full_name || meta.name || meta.display_name
        name = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
      }

      return {
        ...member,
        email,
        name,
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
              <p className="mt-1 text-sm text-slate-500">
                {memberDetails.length} {memberDetails.length === 1 ? 'member' : 'members'} with access to this company
              </p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              ← Back to dashboard
            </Link>
          </div>

          {params.error && (
            <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {params.error}
            </p>
          )}
          {params.success && (
            <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {params.success}
            </p>
          )}

          {/* Collapsible: adding is occasional, so it stays closed and the team list stays in view. */}
          {canManage && (
            <details className="group mb-6 rounded-2xl border border-slate-200 bg-slate-50 open:p-4">
              <summary
                className={`${buttonPrimary} m-0 w-full cursor-pointer list-none group-open:mb-4 group-open:w-auto [&::-webkit-details-marker]:hidden`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
                Add account
              </summary>

              <form action={handleAddMember} className="space-y-4">
                <p className="text-xs text-slate-500">
                  New email: an account is created with the password you set, which you share with them. Existing
                  account: they are simply added and keep their own password.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
                      Full name
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="e.g. Alex Johnson"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="name@company.com"
                      className={inputClass}
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
                      className={inputClass}
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
                      aria-describedby="role-help"
                      className={inputClass}
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <p id="role-help" className="mt-1 text-xs text-slate-500">
                      Employee: own expense and salary requests only. Viewer: read-only. Accountant: edits finances.
                      Admin/Owner: full access.
                    </p>
                  </div>
                </div>

                <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">
                    Payroll details <span className="font-normal text-slate-500">(optional)</span>
                  </legend>
                  <p className="text-xs text-slate-500">
                    Fill these in to also add them to the Employees page. Leave empty to add a login only.
                  </p>

                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="designation" className="block text-xs font-medium text-slate-700">
                        Designation
                      </label>
                      <input
                        id="designation"
                        name="designation"
                        type="text"
                        placeholder="e.g. Senior AI Engineer"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="department" className="block text-xs font-medium text-slate-700">
                        Department
                      </label>
                      <select id="department" name="department" defaultValue="AI Services" className={inputClass}>
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
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="payment_method" className="block text-xs font-medium text-slate-700">
                        Payment method
                      </label>
                      <select id="payment_method" name="payment_method" defaultValue="bank_transfer" className={inputClass}>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                        <option value="crypto">Crypto</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="bank_account_details" className="block text-xs font-medium text-slate-700">
                        Bank / payment details
                      </label>
                      <input
                        id="bank_account_details"
                        name="bank_account_details"
                        type="text"
                        placeholder="IBAN / Bank / Account #"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </fieldset>

                <button type="submit" className={buttonPrimary}>
                  Add account
                </button>
              </form>
            </details>
          )}

          {memberDetails.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No team members yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
              {memberDetails.map((member) => {
                const canEditMember =
                  canManage && member.user_id !== user.id && (member.role !== 'owner' || isOwner)
                const label = member.name ?? member.email

                return (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 p-4 transition-colors duration-200 hover:bg-slate-50 motion-reduce:transition-none lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {label}
                        {member.user_id === user.id && (
                          <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {member.name ? `${member.email} · ` : ''}
                        {ROLE_LABELS[member.role] ?? member.role}
                      </p>
                    </div>

                    {/* All actions for one member on a single row, aligned right (wraps on small screens). */}
                    {canEditMember ? (
                      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                        <form action={handleUpdateMemberRole} className="flex items-center gap-2">
                          <input type="hidden" name="memberId" value={member.id} />
                          <label htmlFor={`role-${member.id}`} className="sr-only">
                            Role for {label}
                          </label>
                          <select
                            id={`role-${member.id}`}
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
                          <button type="submit" className={buttonSecondary}>
                            Update role
                          </button>
                        </form>

                        <ResetPasswordButton memberId={member.id} memberLabel={label} action={handleResetPassword} />

                        <DeleteConfirmButton
                          label="Remove"
                          confirmText={`Remove ${label} from the team? They will lose access.`}
                          action={async () => {
                            'use server'
                            back(await removeMember(member.id), 'Member removed.')
                          }}
                          className={buttonDanger}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
