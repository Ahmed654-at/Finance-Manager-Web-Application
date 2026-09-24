'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateInvoice } from '../actions'

type Customer = {
  id: string
  name: string
}

type InvoiceLineItem = {
  id: string
  description: string
  quantity: string
  unit_price: string
}

type Invoice = {
  id: string
  customer_id: string | null
  invoice_number: string
  issue_date: string | null
  due_date: string | null
  notes: string | null
  tax: number | string | null
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const makeRow = (): InvoiceLineItem => ({
  id:
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: '',
  quantity: '1',
  unit_price: '',
})

export default function InvoiceEditForm({
  customers,
  invoice,
  lineItems,
}: {
  customers: Customer[]
  invoice: Invoice
  lineItems: Array<{ id: string; description: string; quantity: number; unit_price: number }>
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(invoice.customer_id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number)
  const [issueDate, setIssueDate] = useState(invoice.issue_date ?? new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '')
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [lineItemRows, setLineItemRows] = useState<InvoiceLineItem[]>(
    lineItems.length > 0
      ? lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
        }))
      : [makeRow()],
  )
  const [taxAmount, setTaxAmount] = useState(Number(invoice.tax ?? 0))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const subtotal = useMemo(
    () =>
      lineItemRows.reduce((sum, item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = Number(item.unit_price || 0)
        return sum + quantity * unitPrice
      }, 0),
    [lineItemRows],
  )

  const total = subtotal + taxAmount

  const updateLineItem = (id: string, field: 'description' | 'quantity' | 'unit_price', value: string) => {
    setLineItemRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  const addLineItem = () => {
    setLineItemRows((currentRows) => [...currentRows, makeRow()])
  }

  const removeLineItem = (id: string) => {
    setLineItemRows((currentRows) => {
      if (currentRows.length === 1) {
        return currentRows
      }

      return currentRows.filter((row) => row.id !== id)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    formData.set('customer_id', customerId)
    formData.set('invoice_number', invoiceNumber.trim())
    formData.set('issue_date', issueDate)
    formData.set('due_date', dueDate)
    formData.set('notes', notes.trim())
    formData.set('tax', String(taxAmount))
    formData.set(
      'line_items',
      JSON.stringify(
        lineItemRows.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
        })),
      ),
    )

    startTransition(async () => {
      const result = await updateInvoice(invoice.id, formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      router.push(`/dashboard/invoices/${invoice.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="customer_id" className="block text-sm font-medium text-slate-700">
          Customer
        </label>
        <select
          id="customer_id"
          name="customer_id"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        >
          <option value="">Select a customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="invoice_number" className="block text-sm font-medium text-slate-700">
            Invoice number
          </label>
          <input
            id="invoice_number"
            name="invoice_number"
            type="text"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="issue_date" className="block text-sm font-medium text-slate-700">
            Issue date
          </label>
          <input
            id="issue_date"
            name="issue_date"
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium text-slate-700">
          Due date
        </label>
        <input
          id="due_date"
          name="due_date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Line items</h2>
          <button
            type="button"
            onClick={addLineItem}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            + Add line
          </button>
        </div>

        <div className="space-y-3">
          {lineItemRows.map((item, index) => (
            <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[2fr_0.8fr_1.1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                  placeholder="Consulting, design, etc."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Unit price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(event) => updateLineItem(item.id, 'unit_price', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItemRows.length === 1}
                  className="h-10 w-10 rounded-lg border border-slate-300 bg-white text-lg text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove line item ${index + 1}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_180px] md:items-end">
          <div>
            <label htmlFor="tax" className="block text-sm font-medium text-slate-700">
              Tax
            </label>
            <input
              id="tax"
              name="tax"
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={(event) => setTaxAmount(Number(event.target.value || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Subtotal</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{currencyFormatter.format(subtotal)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-sm font-medium text-slate-600">Total</span>
          <span className="text-xl font-semibold text-slate-900">{currencyFormatter.format(total)}</span>
        </div>
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
        {isPending ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  )
}
