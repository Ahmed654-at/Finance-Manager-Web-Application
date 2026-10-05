import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { formatCurrency } from '@/lib/currency'
import { createServiceOrProduct, deleteServiceOrProduct, recordRevenueFromCatalog } from './actions'
import DeleteConfirmButton from '../components/DeleteConfirmButton'

export default async function ServicesAndProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string }
}) {
  const params = (await Promise.resolve(searchParams ?? {})) as { tab?: string }
  const activeTab = params.tab || 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  const canManage = role === 'owner' || role === 'admin'

  // Fetch catalog
  let query = supabase
    .from('services_and_products')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (activeTab === 'ai_service' || activeTab === 'product') {
    query = query.eq('type', activeTab)
  }

  const { data: itemsData } = await query
  const items = itemsData ?? []

  // Fetch customers
  const { data: customersData } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  const customers = customersData ?? []

  // Fetch accounts
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  const accounts = accountsData ?? []

  // Fetch transaction revenue stats for AI Services and Product Selling
  const { data: revenueData } = await supabase
    .from('transactions')
    .select('amount, revenue_stream')
    .eq('company_id', companyId)
    .eq('type', 'income')

  const allRevenue = revenueData ?? []

  const aiServicesRevenue = allRevenue
    .filter((r) => r.revenue_stream === 'ai_services')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const productSellingRevenue = allRevenue
    .filter((r) => r.revenue_stream === 'product_sales')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const otherRevenue = allRevenue
    .filter((r) => r.revenue_stream !== 'ai_services' && r.revenue_stream !== 'product_sales')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const totalRevenue = aiServicesRevenue + productSellingRevenue + otherRevenue
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="px-4 pb-10 pt-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                ← Dashboard
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-700">Revenue Streams</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              AI Services & Products
            </h1>
            <p className="text-sm text-slate-500">
              Track offerings, billable AI solutions, and product selling revenue for {company.name}
            </p>
          </div>
        </div>

        {/* Revenue Attribution KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="animate-fade-in-up rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm transition duration-300 [animation-delay:0ms] hover:-translate-y-1 hover:shadow-lg motion-reduce:animate-none motion-reduce:transition-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">AI Services Income</p>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                {totalRevenue > 0 ? `${Math.round((aiServicesRevenue / totalRevenue) * 100)}%` : '0%'}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-indigo-900">
              {formatCurrency(aiServicesRevenue, company.currency)}
            </p>
            <p className="mt-1 text-xs text-indigo-700">Custom models, prompt agents, consulting</p>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm transition duration-300 [animation-delay:75ms] hover:-translate-y-1 hover:shadow-lg motion-reduce:animate-none motion-reduce:transition-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Product Selling Income</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                {totalRevenue > 0 ? `${Math.round((productSellingRevenue / totalRevenue) * 100)}%` : '0%'}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {formatCurrency(productSellingRevenue, company.currency)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">Software licenses, templates, SaaS subscriptions</p>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 [animation-delay:150ms] hover:-translate-y-1 hover:shadow-lg motion-reduce:animate-none motion-reduce:transition-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Catalog Offerings</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{items.length}</p>
            <p className="mt-1 text-xs text-slate-500">Active products & billable service lines</p>
          </div>
        </div>

        {/* Forms Grid */}
        {canManage && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Add Offering Form */}
            <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [animation-delay:225ms] motion-reduce:animate-none">
              <h2 className="text-lg font-semibold text-slate-900">Add New Product or AI Service</h2>
              <p className="mt-1 text-xs text-slate-500">Define a service packages, API solution, or software product</p>

              <form action={async (formData) => { 'use server'; await createServiceOrProduct(formData) }} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Name *</label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. LLM Agentic Automation"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Offering Type *</label>
                    <select
                      name="type"
                      defaultValue="ai_service"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="ai_service">AI Service / Solution</option>
                      <option value="product">Product / Digital Good</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Base Price ({company.currency}) *</label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 2500"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Billing Model</label>
                    <select
                      name="billing_type"
                      defaultValue="project"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="project">Per Project / Milestone</option>
                      <option value="monthly">Monthly Retainer / Sub</option>
                      <option value="hourly">Hourly Rate</option>
                      <option value="one_off">One-Off Sale</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Description / Scope</label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="e.g. End-to-end custom multi-agent RAG workflow with vector database setup"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-slate-800 hover:shadow-md active:scale-95 motion-reduce:transition-none"
                >
                  Save to Catalog
                </button>
              </form>
            </div>

            {/* Quick Record Revenue Form */}
            <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [animation-delay:300ms] motion-reduce:animate-none">
              <h2 className="text-lg font-semibold text-slate-900">Record Incoming Payment / Sale</h2>
              <p className="mt-1 text-xs text-slate-500">Instantly record revenue linked to an AI service or product sale</p>

              {items.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Add a product or AI service to the catalog first.
                </div>
              ) : (
                <form action={async (formData) => { 'use server'; await recordRevenueFromCatalog(formData) }} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Select Item *</label>
                    <select
                      name="service_id"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.type === 'ai_service' ? '🤖' : '📦'} {i.name} ({formatCurrency(i.price, company.currency)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Amount Received ({company.currency}) *</label>
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        placeholder="Amount"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Date Received</label>
                      <input
                        name="date"
                        type="date"
                        defaultValue={today}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Deposit into Account</label>
                      <select
                        name="account_id"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      >
                        <option value="">None / External</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.opening_balance, company.currency)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">Client / Customer (Optional)</label>
                      <select
                        name="customer_id"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      >
                        <option value="">General / Walk-in Buyer</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Reference / Notes</label>
                    <input
                      name="notes"
                      type="text"
                      placeholder="e.g. Milestone 1 payment or License key purchase"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-emerald-800 hover:shadow-md active:scale-95 motion-reduce:transition-none"
                  >
                    Record Income to Ledger
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Offerings Catalog Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Offerings Directory</h2>
              <p className="text-xs text-slate-500">Products and AI solutions offered by your company</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { key: 'all', label: 'All Items' },
                { key: 'ai_service', label: 'AI Services' },
                { key: 'product', label: 'Products' },
              ].map((t) => (
                <Link
                  key={t.key}
                  href={`/dashboard/services?tab=${t.key}`}
                  className={`rounded-lg border px-3 py-1.5 font-medium transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none ${
                    activeTab === t.key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No items in this category yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Item Name</th>
                    <th className="pb-3 pr-4">Stream Type</th>
                    <th className="pb-3 pr-4">Base Pricing</th>
                    <th className="pb-3 pr-4">Billing Model</th>
                    <th className="pb-3 pr-4">Description</th>
                    {canManage && <th className="pb-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors duration-200 hover:bg-slate-50 motion-reduce:transition-none">
                      <td className="py-3 pr-4 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.type === 'ai_service'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.type === 'ai_service' ? 'AI Service' : 'Product'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {formatCurrency(item.price, company.currency)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600 capitalize">
                        {item.billing_type.replace('_', ' ')}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 max-w-xs truncate">
                        {item.description || '—'}
                      </td>
                      {canManage && (
                        <td className="py-3 text-right">
                          <DeleteConfirmButton
                            label="Delete"
                            confirmText="Delete this offering?"
                            action={async () => {
                              'use server'
                              await deleteServiceOrProduct(item.id)
                            }}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
