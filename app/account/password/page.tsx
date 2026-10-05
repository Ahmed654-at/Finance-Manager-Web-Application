import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { changePassword } from './actions'

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
}) {
  const params = (await searchParams) ?? {}

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { role } = await getCompanyContext(supabase, user)
  const backHref = role === 'employee' ? '/my-expenses' : '/dashboard'

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6">
          <Link href={backHref} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Change password</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>

        {params.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </div>
        )}
        {params.success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {params.success}
          </div>
        )}

        <form action={changePassword} className="space-y-4">
          <div>
            <label htmlFor="current_password" className="mb-1 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new_password" className="mb-1 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
          >
            Change password
          </button>
        </form>
      </div>
    </main>
  )
}
