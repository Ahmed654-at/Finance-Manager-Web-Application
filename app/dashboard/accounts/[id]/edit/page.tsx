import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canWrite, getCompanyContext } from '@/lib/company'
import DeleteConfirmButton from '../../../components/DeleteConfirmButton'
import { deleteAccount, updateAccount } from '../../actions'

export default async function EditAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { id } = await params
  const query = (await searchParams) ?? {}

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, company, role } = await getCompanyContext(supabase, user)

  // Read-only roles can view accounts but not change them.
  if (!canWrite(role)) redirect('/dashboard/accounts')

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!account) notFound()

  async function handleUpdate(formData: FormData) {
    'use server'
    const result = await updateAccount(id, formData)
    if (result?.error) {
      redirect(`/dashboard/accounts/${id}/edit?error=${encodeURIComponent(result.error)}`)
    }
  }

  async function handleDelete() {
    'use server'
    const result = await deleteAccount(id)
    if (result?.error) {
      redirect(`/dashboard/accounts/${id}/edit?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{company.name} · Accounts</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit account</h1>
            </div>
            <Link
              href="/dashboard/accounts"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to accounts
            </Link>
          </div>

          {query.error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {query.error}
            </p>
          )}

          <form action={handleUpdate} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Account name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={account.name}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={account.type}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit</option>
                <option value="savings">Savings</option>
              </select>
            </div>

            <div>
              <label htmlFor="opening_balance" className="block text-sm font-medium text-slate-700">
                Opening balance
              </label>
              <input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={Number(account.opening_balance ?? 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                The current balance is this amount plus income minus expenses, so changing it shifts the balance.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={account.is_active}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active (untick to hide this account from the payment dropdowns)
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Save account
            </button>
          </form>

          <div className="mt-4">
            <DeleteConfirmButton
              action={handleDelete}
              label="Delete account"
              confirmText={`Delete "${account.name}"? This cannot be undone.`}
              className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
