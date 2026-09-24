'use client'

import { useState, useTransition } from 'react'
import { createTransaction } from './actions'

type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
}

type Account = {
  id: string
  name: string
}

type TransactionFormProps = {
  categories: Category[]
  accounts: Account[]
}

export default function TransactionForm({ categories, accounts }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]
  const filteredCategories = categories.filter((category) => category.type === type)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createTransaction(formData)

      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700">Type</label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label
            className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition ${
              type === 'income'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="type"
              value="income"
              checked={type === 'income'}
              onChange={() => setType('income')}
              className="sr-only"
            />
            Income
          </label>

          <label
            className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition ${
              type === 'expense'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="type"
              value="expense"
              checked={type === 'expense'}
              onChange={() => setType('expense')}
              className="sr-only"
            />
            Expense
          </label>
        </div>
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
          required
          placeholder="0.00"
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
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        >
          <option value="">No category</option>
          {filteredCategories.map((category) => (
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
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        >
          <option value="">No account</option>
          {accounts.map((account) => (
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
          placeholder="Groceries, rent, invoice, etc."
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
          defaultValue={today}
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
          placeholder="Optional invoice or note"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Saving...' : 'Save transaction'}
      </button>
    </form>
  )
}
