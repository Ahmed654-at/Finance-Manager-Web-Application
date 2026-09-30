import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { findPayrollEmployee } from '@/lib/payroll'
import { formatCurrency } from '@/lib/currency'
import { approveSalaryRequest, rejectSalaryRequest } from './actions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

export default async function SalaryRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string }>
}) {
  const params = (await searchParams) ?? {}
  const statusFilter = params.status || 'pending'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { companyId, company, role } = await getCompanyContext(supabase, user)
  const canReview = role === 'owner' || role === 'admin'

  const { data: accountsData } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
  const accounts = accountsData ?? []

  let query = supabase
    .from('salary_requests')
    .select('*, accounts(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data } = await query
  const requests = data ?? []

  // Expected monthly salary per requester, from their payroll record.
  const expectedByRequest = new Map<string, number | null>()
  await Promise.all(
    requests.map(async (req) => {
      const match = await findPayrollEmployee(supabase, companyId, req.submitted_by, req.submitted_by_name)
      expectedByRequest.set(req.id, match ? Number(match.salary_amount) : null)
    }),
  )

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Salary Requests</h1>
          <p className="text-sm text-slate-500">
            Salary requested by team members. Approving a request records the salary as an expense in {company.name}.
          </p>
        </div>

        {params.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{params.error}</p>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            {['pending', 'approved', 'rejected', 'all'].map((st) => (
              <Link
                key={st}
                href={`/dashboard/salary-requests?status=${st}`}
                className={`rounded-lg border px-3 py-1.5 font-medium capitalize transition ${
                  statusFilter === st
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {st}
              </Link>
            ))}
          </div>

          {requests.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No {statusFilter === 'all' ? '' : statusFilter} salary requests.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3 pr-4">Requested</th>
                    <th className="pb-3 pr-4">Employee</th>
                    <th className="pb-3 pr-4">Salary month</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Status</th>
                    {canReview && <th className="pb-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 text-slate-600">{String(req.created_at).slice(0, 10)}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {req.submitted_by_name}
                        {req.notes && <p className="max-w-xs text-xs font-normal text-slate-500">{req.notes}</p>}
                        {req.review_note && (
                          <p className="text-xs font-normal italic text-slate-500">Review: {req.review_note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{req.payment_month}</td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {formatCurrency(req.amount, company.currency)}
                        {(() => {
                          const expected = expectedByRequest.get(req.id)
                          if (expected === null || expected === undefined) {
                            return <p className="text-xs font-normal text-slate-500">No payroll record found</p>
                          }
                          const differs = Math.abs(expected - Number(req.amount)) > 0.009
                          return (
                            <p className={`text-xs font-normal ${differs ? 'text-amber-600' : 'text-slate-500'}`}>
                              Expected: {formatCurrency(expected, company.currency)}
                              {differs ? ' — differs' : ''}
                            </p>
                          )
                        })()}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[req.status] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {req.status}
                        </span>
                        {req.status === 'approved' && req.accounts?.name && (
                          <p className="mt-1 text-xs text-slate-500">Paid from {req.accounts.name}</p>
                        )}
                      </td>
                      {canReview && (
                        <td className="py-3 text-right">
                          {req.status === 'pending' && (
                            <div className="flex flex-col items-end gap-2">
                              <form
                                action={async (formData: FormData) => {
                                  'use server'
                                  const result = await approveSalaryRequest(
                                    req.id,
                                    String(formData.get('account_id') ?? ''),
                                  )
                                  if (result?.error) {
                                    redirect(`/dashboard/salary-requests?error=${encodeURIComponent(result.error)}`)
                                  }
                                }}
                                className="flex items-center gap-1"
                              >
                                <select
                                  name="account_id"
                                  className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                                >
                                  <option value="">Pay from: none</option>
                                  {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                                >
                                  Approve
                                </button>
                              </form>

                              <form
                                action={async (formData: FormData) => {
                                  'use server'
                                  const result = await rejectSalaryRequest(req.id, String(formData.get('note') ?? ''))
                                  if (result?.error) {
                                    redirect(`/dashboard/salary-requests?error=${encodeURIComponent(result.error)}`)
                                  }
                                }}
                                className="flex items-center gap-1"
                              >
                                <input
                                  name="note"
                                  placeholder="Reason (optional)"
                                  className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              </form>
                            </div>
                          )}
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
