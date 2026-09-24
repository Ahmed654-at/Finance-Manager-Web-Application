import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAccount } from './actions'

type Account = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  opening_balance: number | string | null
}

async function handleCreateAccount(formData: FormData) {
  'use server'
  await createAccount(formData)
}

export default async function AccountsPage() {
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
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const companyId = membership.company_id

  const { data: accountsResult } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  const accounts = (accountsResult ?? []) as Account[]

  const accountSummaries = await Promise.all(
    accounts.map(async (account) => {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('company_id', companyId)
        .eq('account_id', account.id)

      const net = (transactions ?? []).reduce((sum, transaction) => {
        const amount = Number(transaction.amount || 0)
        return transaction.type === 'income' ? sum + amount : sum - amount
      }, 0)

      const openingBalance = Number(account.opening_balance ?? 0)
      const currentBalance = openingBalance + net

      return {
        ...account,
        currentBalance,
      }
    }),
  )

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <form
            action={handleCreateAccount}
            className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Account name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Business checking"
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
                defaultValue="cash"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit</option>
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
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add account
            </button>
          </form>

          {accountSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No accounts yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Add your first account to track cash balances and transaction activity.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accountSummaries.map((account) => (
                <div
                  key={account.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{account.name}</p>
                      <span className="mt-2 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {account.type}
                      </span>
                    </div>

                    <p
                      className={`text-lg font-semibold ${account.currentBalance < 0 ? 'text-red-600' : 'text-slate-900'}`}
                    >
                      ${account.currentBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
