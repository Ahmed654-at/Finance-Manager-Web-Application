'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Invoices', href: '/dashboard/invoices' },
  { label: 'Transactions', href: '/dashboard/transactions' },
  { label: 'Employees', href: '/dashboard/employees' },
  { label: 'Team Expenses', href: '/dashboard/team-expenses' },
  { label: 'Salary Requests', href: '/dashboard/salary-requests' },
  { label: 'AI & Products', href: '/dashboard/services' },
  { label: 'Budgets', href: '/dashboard/budgets' },
  { label: 'Accounts', href: '/dashboard/accounts' },
  { label: 'Reports', href: '/dashboard/reports' },
  { label: 'Team', href: '/dashboard/team' },
  { label: 'Settings', href: '/dashboard/settings' },
]

export default function DashboardNav({
  userEmail,
  accountName,
}: {
  companyName: string
  userEmail?: string | null
  accountName?: string | null
}) {
  const pathname = usePathname()

  const displayName = accountName || (userEmail ? userEmail.split('@')[0] : 'Account')
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || displayName.slice(0, 2).toUpperCase()

  return (
    <header className="mb-8 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            Company Finance Manager
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            title="Click to open Account & Company Settings"
            className="group flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-slate-100/80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm ring-2 ring-slate-100 group-hover:ring-slate-400">
              {initials}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-tight group-hover:text-blue-600">
                {displayName}
              </span>
              {userEmail && (
                <span className="hidden text-[11px] text-slate-500 leading-tight truncate max-w-[13rem] sm:inline">
                  {userEmail}
                </span>
              )}
            </div>
          </Link>

          <Link
            href="/account/password"
            className="hidden text-xs font-medium text-slate-500 transition hover:text-slate-900 sm:inline"
          >
            Change password
          </Link>

          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(`${item.href}/`)

          const isSettings = item.href === '/dashboard/settings'

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                isSettings ? 'sm:ml-auto' : ''
              } ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : isSettings
                  ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
