import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InvoiceForm from './InvoiceForm'

export default async function NewInvoicePage() {
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

  const { data: customersResult } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name')

  const customers = customersResult ?? []
  const suggestedNumber = `INV-${Date.now()}`

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">New Invoice</h1>
            <a
              href="/dashboard/invoices"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to invoices
            </a>
          </div>

          <InvoiceForm customers={customers} suggestedNumber={suggestedNumber} />
        </div>
      </div>
    </main>
  )
}
