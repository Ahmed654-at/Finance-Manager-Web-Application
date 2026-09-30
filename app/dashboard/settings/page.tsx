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
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
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
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                placeholder="e.g. Haseeb Shakeel"
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
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 shadow-sm"
            >
              Update Account Name
            </button>
          </form>
        </div>

        {/* Email & Invoicing Service Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Email & Invoicing Delivery</h2>
            <p className="mt-1 text-xs text-slate-500">
              Settings for automated invoice delivery and payment receipts via Resend.
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Email Delivery Provider</p>
                  <p className="text-xs text-slate-500">Resend API</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Connected
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-600">
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Default Sender (&quot;From&quot;):</span>
                  <span className="font-mono text-slate-800">
                    {process.env.RESEND_FROM_EMAIL || 'Finance Manager <onboarding@resend.dev>'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Sending Mode:</span>
                  <span className="font-medium text-amber-700">
                    {!process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL.includes('resend.dev')
                      ? 'Sandbox / Test Mode (onboarding@resend.dev)'
                      : 'Production (Custom Domain)'}
                  </span>
                </div>
              </div>
            </div>

            {(!process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL.includes('resend.dev')) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
                <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <span>ℹ</span> Why aren&apos;t emails arriving in your personal or customer inboxes?
                </p>
                <p className="mt-1.5 text-amber-800">
                  In free Resend test mode, Resend only allows sending emails to the specific email address
                  registered on that Resend account. Attempting to send invoices to any other recipient will be
                  blocked by Resend with a 403 error.
                </p>
                <div className="mt-3 space-y-1.5 text-amber-950">
                  <p className="font-medium">To deliver invoices to yourself or any client:</p>
                  <p>
                    <strong>1. Free Testing:</strong> Sign up at{' '}
                    <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline font-semibold">
                      resend.com
                    </a>{' '}
                    with your email, create a new API key, and set <code>RESEND_API_KEY</code> in your <code>.env</code>.
                  </p>
                  <p>
                    <strong>2. Full Production:</strong> Verify your domain at{' '}
                    <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-semibold">
                      resend.com/domains
                    </a>{' '}
                    and set <code>RESEND_FROM_EMAIL=&quot;billing@yourdomain.com&quot;</code> in <code>.env</code>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
