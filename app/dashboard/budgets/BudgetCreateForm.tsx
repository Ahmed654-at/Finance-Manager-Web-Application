'use client'

import { useState } from 'react'
import { createBudget } from './actions'

type Category = {
  id: string
  name: string
  type?: string
  description?: string | null
}

const QUICK_CATEGORIES = [
  {
    name: 'Marketing',
    badge: 'Marketing',
    icon: '📢',
    desc: 'Ad campaigns, social ads, outreach',
    chipClass: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-300',
    activeClass: 'ring-2 ring-blue-500 bg-blue-100 border-blue-400 font-semibold',
  },
  {
    name: 'Employees Salaries',
    badge: 'Employees Salaries',
    icon: '👥',
    desc: 'Engineering & team payroll',
    chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300',
    activeClass: 'ring-2 ring-emerald-500 bg-emerald-100 border-emerald-400 font-semibold',
  },
  {
    name: 'Team Travelling',
    badge: 'Team Travelling',
    icon: '✈️',
    desc: 'Flights, hotels & client visits',
    chipClass: 'border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 hover:border-purple-300',
    activeClass: 'ring-2 ring-purple-500 bg-purple-100 border-purple-400 font-semibold',
  },
  {
    name: 'Team Lunch',
    badge: 'Team Lunch',
    icon: '🍱',
    desc: 'Lunches, catering & team meals',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-300',
    activeClass: 'ring-2 ring-amber-500 bg-amber-100 border-amber-400 font-semibold',
  },
]

export default function BudgetCreateForm({
  categories,
  currency = 'USD',
}: {
  categories: Category[]
  currency?: string
}) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  const defaultStart = `${year}-${month}-01`
  const defaultEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [budgetName, setBudgetName] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(defaultStart)
  const [endDate, setEndDate] = useState<string>(defaultEnd)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleAction = async (formData: FormData): Promise<void> => {
    setSubmitting(true)
    setFormError(null)
    const result = await createBudget(formData)
    if (result && 'error' in result && result.error) {
      setFormError(result.error)
      setSubmitting(false)
    }
  }

  const handleSelectQuickCategory = (quickName: string) => {
    const matched = categories.find(
      (c) => c.name.toLowerCase().trim() === quickName.toLowerCase().trim()
    )

    if (matched) {
      setSelectedCategoryId(matched.id)
      if (!budgetName || QUICK_CATEGORIES.some((q) => budgetName === `${q.name} Budget`)) {
        setBudgetName(`${matched.name} Budget`)
      }
    }
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  return (
    <form
      action={handleAction}
      className="mb-8 space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:shadow"
    >
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-semibold text-slate-800">
            Target Expense Category <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-slate-500">Pick below or choose from dropdown</span>
        </div>

        {/* Quick Category Selector Chips */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_CATEGORIES.map((quick) => {
            const isMatch = selectedCategory?.name.toLowerCase().trim() === quick.name.toLowerCase().trim()
            return (
              <button
                key={quick.name}
                type="button"
                onClick={() => handleSelectQuickCategory(quick.name)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left text-xs transition ${
                  quick.chipClass
                } ${isMatch ? quick.activeClass : ''}`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>{quick.icon}</span>
                  <span>{quick.badge}</span>
                </div>
                <span className="mt-1 line-clamp-1 text-[11px] opacity-80">{quick.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Full Category Select Dropdown */}
        <select
          id="category_id"
          name="category_id"
          required
          value={selectedCategoryId}
          onChange={(e) => {
            const newCatId = e.target.value
            setSelectedCategoryId(newCatId)
            const cat = categories.find((c) => c.id === newCatId)
            if (cat && (!budgetName || QUICK_CATEGORIES.some((q) => budgetName === `${q.name} Budget`))) {
              setBudgetName(`${cat.name} Budget`)
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        >
          {categories.length === 0 ? (
            <option value="" disabled>
              No expense categories available
            </option>
          ) : (
            <>
              <option value="" disabled>
                -- Select an expense category --
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} {category.description ? `(${category.description})` : ''}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-slate-800">
          Budget Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={budgetName}
          onChange={(e) => setBudgetName(e.target.value)}
          placeholder="e.g. Marketing Q4 Budget, Employees Monthly Payroll"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-semibold text-slate-800">
            Budget Amount ({currency}) <span className="text-red-500">*</span>
          </label>
          <div className="relative mt-1">
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="start_date" className="block text-sm font-semibold text-slate-800">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="end_date" className="block text-sm font-semibold text-slate-800">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
        >
          {submitting ? 'Creating Budget...' : 'Create Budget'}
        </button>
      </div>
    </form>
  )
}
