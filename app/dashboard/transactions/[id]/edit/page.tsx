'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeleteConfirmButton from '../../../components/DeleteConfirmButton'
import { deleteTransaction, updateTransaction } from './actions'

type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
}

type Account = {
  id: string
  name: string
}

type TransactionRecord = {
  id: string
  type: 'income' | 'expense'
  amount: number | string | null
  category_id: string | null
  account_id: string | null
  description: string | null
  transaction_date: string | null
  reference: string | null
}

export default function EditTransactionPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transaction, setTransaction] = useState<TransactionRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!user || userError) {
        router.push('/login')
        return
      }

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership) {
        router.push('/onboarding')
        return
      }

      const [{ data: categoriesData }, { data: accountsData }, { data: transactionData }] = await Promise.all([
        supabase.from('categories').select('*').eq('company_id', membership.company_id).order('name'),
        supabase.from('accounts').select('*').eq('company_id', membership.company_id).order('name'),
        supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .eq('company_id', membership.company_id)
          .limit(1)
          .maybeSingle(),
      ])

      if (!transactionData) {
        router.push('/dashboard/transactions')
        return
      }

      setCategories((categoriesData ?? []) as Category[])
      setAccounts((accountsData ?? []) as Account[])
      setTransaction(transactionData as TransactionRecord)
      setLoading(false)
    }

    void fetchData()
  }, [id, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!id) return

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await updateTransaction(id, formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      router.push('/dashboard/transactions')
    })
  }

  if (loading || !transaction) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Transactions</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit transaction</h1>
            </div>
            <Link
              href="/dashboard/transactions"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to transactions
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={transaction.type}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={Number(transaction.amount ?? 0)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                defaultValue={transaction.category_id ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="">No category</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="account_id" className="block text-sm font-medium text-slate-700">
                Account
              </label>
              <select
                id="account_id"
                name="account_id"
                defaultValue={transaction.account_id ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                <option value="">No account</option>
                {(accounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                id="description"
                name="description"
                type="text"
                defaultValue={transaction.description ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="transaction_date" className="block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                id="transaction_date"
                name="transaction_date"
                type="date"
                defaultValue={transaction.transaction_date ?? ''}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reference" className="block text-sm font-medium text-slate-700">
                Reference
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                defaultValue={transaction.reference ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>

          <div className="mt-4">
            <DeleteConfirmButton
              action={deleteTransaction.bind(null, id)}
              label="Delete"
              confirmText="Delete this transaction?"
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
