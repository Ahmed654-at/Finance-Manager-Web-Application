import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AuditLog = {
  id: string
  user_id: string
  action: string
  entity_type: string
  summary: string
  created_at: string
}

const entityOptions = [
  { key: 'all', label: 'All' },
  { key: 'transaction', label: 'Transactions' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'budget', label: 'Budgets' },
  { key: 'customer', label: 'Customers' },
  { key: 'category', label: 'Categories' },
  { key: 'account', label: 'Accounts' },
  { key: 'team', label: 'Team' },
  { key: 'company', label: 'Company' },
]

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ entity_type?: string }> | { entity_type?: string }
}) {
  const params = (await Promise.resolve(searchParams ?? {})) as { entity_type?: string }
  const selectedEntity = params.entity_type ?? 'all'

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

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (selectedEntity !== 'all') {
    query = query.eq('entity_type', selectedEntity)
  }

  const { data: auditRows } = await query

  const logs = (auditRows ?? []) as AuditLog[]

  const logEntries = await Promise.all(
    logs.map(async (log) => {
      let email = 'Unknown user'

      if (supabaseAdmin) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(log.user_id)
        email = userData?.user?.email ?? email
      }

      return {
        ...log,
        email,
      }
    }),
  )

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Activity Log</h1>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {entityOptions.map((option) => {
              const isActive = selectedEntity === option.key
              const href = option.key === 'all' ? '/dashboard/audit' : `/dashboard/audit?entity_type=${option.key}`

              return (
                <Link
                  key={option.key}
                  href={href}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>

          {logEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-slate-700">No activity yet</p>
              <p className="mt-2 text-sm text-slate-500">Your company activity will appear here once events are logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium">Action</th>
                    <th className="pb-3 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0">
                      <td className="py-3 pr-4 whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{log.email}</td>
                      <td className="py-3 pr-4 whitespace-nowrap capitalize">
                        {log.action} {log.entity_type}
                      </td>
                      <td className="py-3">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
