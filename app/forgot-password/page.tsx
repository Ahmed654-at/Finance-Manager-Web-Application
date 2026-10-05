import Link from 'next/link'
import { requestPasswordReset } from './actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; sent?: string }>
}) {
  const params = (await searchParams) ?? {}

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to sign in
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email and we will send you a reset link.</p>
        </div>

        {params.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {params.sent ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p>If an account exists for that email, a reset link is on its way.</p>
            <p className="text-xs text-emerald-700">
              Nothing arrived? Ask your company owner or admin to reset your password from the Team page.
            </p>
          </div>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              Send reset link
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
