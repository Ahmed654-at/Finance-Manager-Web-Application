import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { updateCompany, updateAccountProfile } from './actions'
import { getAccountName } from '@/lib/user'

async function handleUpdateCompany(formData: FormData) {
  'use server'
  await updateCompany(formData)
}

async function handleUpdateAccount(formData: FormData) {
  'use server'
  await updateAccountProfile(formData)
}

export default async function CompanySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { company, role } = await getCompanyContext(supabase, user)
  const accountName = await getAccountName(supabase, user)
  const canEdit = role === 'owner' || role === 'admin'

  return (
    <main className="px-4 pb-10 pt-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">Company Settings</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          {!canEdit && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Only company admins can edit these settings
            </div>
          )}

          <form action={handleUpdateCompany} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Company name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={company.name ?? ''}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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
                defaultValue={company.email ?? ''}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={company.phone ?? ''}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                rows={4}
                defaultValue={company.address ?? ''}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={company.currency ?? 'PKR'}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!canEdit}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              Save company settings
            </button>
          </form>
        </div>

        {/* Account Profile Settings Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Your Account Profile</h2>
            <p className="mt-1 text-xs text-slate-500">
              Customize the account name displayed on your dashboard and account badge.
            </p>
          </div>

          <form action={handleUpdateAccount} className="space-y-4">
            <div>
              <label htmlFor="account_name" className="block text-sm font-medium text-slate-700">
                Account Name
              </label>
              <input
                id="account_name"
                name="account_name"
                type="text"
                required
                defaultValue={accountName}
                placeholder="e.g. Alex Johnson"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Account Email
              </label>
              <input
                type="text"
                disabled
                defaultValue={user.email ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-slate-400">Authenticated login email address.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Company Role
              </label>
              <div className="mt-1">
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {role}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 shadow-sm transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              Update Account Name
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Password</p>
              <p className="mt-0.5 text-xs text-slate-500">Change the password you use to sign in.</p>
            </div>
            <Link
              href="/account/password"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              Change password
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
