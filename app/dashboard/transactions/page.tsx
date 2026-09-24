import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeleteConfirmButton from '../components/DeleteConfirmButton'
import { deleteTransaction } from './[id]/edit/actions'
import { importTransactionsCsv } from './import/actions'

type SearchParamsValue = string | string[] | undefined

type SearchParams = Record<string, SearchParamsValue>

type Category = {
  id: string
  name: string
}

type Account = {
  id: string
  name: string
}

async function handleImportCsv(formData: FormData) {
  'use server'
  await importTransactionsCsv(formData)
  return
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams
}) {
  const params = (await Promise.resolve(searchParams ?? {})) as SearchParams

  const getParam = (key: string) => {
    const value = params[key]
    if (Array.isArray(value)) {
      return value[0] ?? ''
    }
    return value ?? ''
  }

  const from = getParam('from')
  const to = getParam('to')
  const type = getParam('type')
  const categoryIdFilter = getParam('category_id')
  const accountIdFilter = getParam('account_id')
  const search = getParam('search')

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

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  let query = supabase
    .from('transactions')
    .select('*, categories(name), accounts(name)')
    .eq('company_id', companyId)

  if (from) {
    query = query.gte('transaction_date', from)
  }

  if (to) {
    query = query.lte('transaction_date', to)
  }

  if (type && ['income', 'expense'].includes(type)) {
    query = query.eq('type', type)
  }

  if (categoryIdFilter) {
    query = query.eq('category_id', categoryIdFilter)
  }

  if (accountIdFilter) {
    query = query.eq('account_id', accountIdFilter)
  }

  if (search) {
    query = query.ilike('description', `%${search}%`)
  }

  const { data: transactionRows } = await query.order('transaction_date', { ascending: false })

  const transactions = (transactionRows ?? []) as Array<{
    id: string
    transaction_date: string
    description: string | null
    amount: number | string | null
    type: 'income' | 'expense'
    categories?: { name: string } | null
    accounts?: { name: string } | null
    account_id?: string | null
  }>

  const hasFilters = Boolean(from || to || type || categoryIdFilter || accountIdFilter || search)

  const buildExportUrl = () => {
    const params = new URLSearchParams()

    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (type) params.set('type', type)
    if (categoryIdFilter) params.set('category_id', categoryIdFilter)
    if (accountIdFilter) params.set('account_id', accountIdFilter)
    if (search) params.set('search', search)

    const queryString = params.toString()
    return queryString ? `/dashboard/transactions/export?${queryString}` : '/dashboard/transactions/export'
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                ← Back to dashboard
              </Link>
              <Link
                href="/dashboard/transactions/new"
                className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                + Add Transaction
              </Link>
            </div>
          </div>

          <form method="get" action="/dashboard/transactions" className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div>
                <label htmlFor="from" className="block text-sm font-medium text-slate-700">
                  From
                </label>
                <input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={from}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="to" className="block text-sm font-medium text-slate-700">
                  To
                </label>
                <input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={to}
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
                  defaultValue={type}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-slate-700">
                  Category
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  defaultValue={categoryIdFilter}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  <option value="">All</option>
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
                  defaultValue={accountIdFilter}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  <option value="">All</option>
                  {(accounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="search" className="block text-sm font-medium text-slate-700">
                  Search
                </label>
                <input
                  id="search"
                  name="search"
                  type="text"
                  defaultValue={search}
                  placeholder="Description"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Filter
              </button>
              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Clear filters
              </Link>
            </div>
          </form>

          <div className="mb-6 flex items-center justify-end gap-3">
            <Link
              href={buildExportUrl()}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Export CSV
            </Link>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <form action={handleImportCsv} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="csvFile" className="block text-sm font-medium text-slate-700">
                  Import CSV
                </label>
                <input
                  id="csvFile"
                  name="file"
                  type="file"
                  accept=".csv"
                  required
                  className="mt-1 block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Import
              </button>
            </form>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No transactions found</p>
              <p className="mt-2 text-sm text-slate-500">
                {hasFilters
                  ? 'Try adjusting your filters to broaden the search.'
                  : 'No transactions have been recorded for this company yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Account</th>
                    <th className="pb-3 pr-4 font-medium">Description</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const amount = Number(transaction.amount || 0)
                    const isIncome = transaction.type === 'income'
                    const categoryName = transaction.categories?.name || 'Uncategorized'
                    const accountName = transaction.accounts?.name || '—'

                    return (
                      <tr key={transaction.id} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                        <td className="py-3 pr-4">{transaction.transaction_date || '—'}</td>
                        <td className="py-3 pr-4">{categoryName}</td>
                        <td className="py-3 pr-4">{accountName}</td>
                        <td className="py-3 pr-4">{transaction.description || '—'}</td>
                        <td className={`py-3 pr-4 font-medium ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'}{currencyFormatter.format(Math.abs(amount))}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                              isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/transactions/${transaction.id}/edit`}
                              className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                            >
                              Edit
                            </Link>
                            <DeleteConfirmButton
                              action={deleteTransaction.bind(null, transaction.id)}
                              label="Delete"
                              confirmText="Delete this transaction?"
                              className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
