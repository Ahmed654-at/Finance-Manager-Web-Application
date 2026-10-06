'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type NavItem = {
  label: string
  href: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Finance',
    items: [
      { label: 'Overview', href: '/dashboard' },
      { label: 'Transactions', href: '/dashboard/transactions' },
      { label: 'Invoices', href: '/dashboard/invoices' },
      { label: 'Accounts', href: '/dashboard/accounts' },
      { label: 'Budgets', href: '/dashboard/budgets' },
      { label: 'Reports', href: '/dashboard/reports' },
      { label: 'AI & Products', href: '/dashboard/services' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', href: '/dashboard/employees' },
      { label: 'Team Expenses', href: '/dashboard/team-expenses' },
      { label: 'Salary Requests', href: '/dashboard/salary-requests' },
      { label: 'Team', href: '/dashboard/team' },
    ],
  },
]

const settingsItem: NavItem = { label: 'Settings', href: '/dashboard/settings' }

// Desktop bar: the everyday pages stay visible; the rest are grouped into two dropdowns,
// so the top level has 6 entries instead of 12. The mobile menu still lists every page, grouped.
type NavDropdown = { id: string; label: string; items: NavItem[] }

const desktopLinks: NavItem[] = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Transactions', href: '/dashboard/transactions' },
  { label: 'Invoices', href: '/dashboard/invoices' },
]

const desktopDropdowns: NavDropdown[] = [
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { label: 'Accounts', href: '/dashboard/accounts' },
      { label: 'Budgets', href: '/dashboard/budgets' },
      { label: 'Reports', href: '/dashboard/reports' },
      { label: 'AI & Products', href: '/dashboard/services' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Employees', href: '/dashboard/employees' },
      { label: 'Team Expenses', href: '/dashboard/team-expenses' },
      { label: 'Salary Requests', href: '/dashboard/salary-requests' },
      { label: 'Team', href: '/dashboard/team' },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DashboardNav({
  companyName,
  userEmail,
  accountName,
}: {
  companyName: string
  userEmail?: string | null
  accountName?: string | null
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const desktopNavRef = useRef<HTMLElement>(null)

  // The email is only used to derive a fallback name; it is never displayed.
  const displayName = accountName || (userEmail ? userEmail.split('@')[0] : 'Account')
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || displayName.slice(0, 2).toUpperCase()

  // Escape closes whichever menu is open.
  useEffect(() => {
    if (!menuOpen && !accountOpen && !openDropdown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setAccountOpen(false)
        setOpenDropdown(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, accountOpen, openDropdown])

  // Clicking outside the desktop bar closes an open Finance / People dropdown.
  useEffect(() => {
    if (!openDropdown) return
    const onPointerDown = (event: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [openDropdown])

  // Clicking outside the account menu closes it.
  useEffect(() => {
    if (!accountOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [accountOpen])

  const closeMenus = () => {
    setMenuOpen(false)
    setAccountOpen(false)
    setOpenDropdown(null)
  }

  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 motion-reduce:transition-none ${
      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <header className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-black px-4 py-3 shadow-sm lg:px-5">
        <Link href="/dashboard" className="min-w-0" onClick={closeMenus}>
          <p className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            Company Finance Manager
          </p>
          <p className="truncate text-xs text-slate-500">{companyName}</p>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Account menu: name + avatar opens Account settings / Change password */}
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountOpen((open) => !open)
                setMenuOpen(false)
              }}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-controls="dashboard-account-menu"
              className="group flex items-center gap-2.5 rounded-lg p-1 transition duration-200 hover:bg-slate-50 motion-reduce:transition-none"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white ring-2 ring-slate-100 group-hover:ring-slate-400">
                {initials}
              </span>
              <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-slate-900 md:inline">
                {displayName}
              </span>
              <svg
                viewBox="0 0 20 20"
                className={`hidden h-4 w-4 text-slate-400 transition-transform duration-200 motion-reduce:transition-none md:block ${accountOpen ? 'rotate-180' : ''}`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
              </svg>
            </button>

            {accountOpen && (
              <div
                id="dashboard-account-menu"
                role="menu"
                className="absolute right-0 z-20 mt-2 w-56 animate-fade-in-up overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg motion-reduce:animate-none"
              >
                <p className="truncate border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <Link
                  href="/dashboard/settings"
                  role="menuitem"
                  onClick={closeMenus}
                  className="block px-4 py-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100 motion-reduce:transition-none"
                >
                  Account settings
                </Link>
                <Link
                  href="/account/password"
                  role="menuitem"
                  onClick={closeMenus}
                  className="block px-4 py-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100 motion-reduce:transition-none"
                >
                  Change password
                </Link>
                <form action="/logout" method="post" className="border-t border-slate-100 lg:hidden">
                  <button
                    type="submit"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 motion-reduce:transition-none"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>

          <form action="/logout" method="post" className="hidden lg:block">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition duration-200 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm active:scale-95 motion-reduce:transition-none"
            >
              Sign out
            </button>
          </form>

          {/* Mobile / tablet page menu */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen((open) => !open)
              setAccountOpen(false)
            }}
            aria-expanded={menuOpen}
            aria-controls="dashboard-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-200 hover:bg-slate-100 active:scale-95 motion-reduce:transition-none lg:hidden"
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Desktop navigation */}
      <nav
        ref={desktopNavRef}
        aria-label="Main"
        className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-black p-2 shadow-sm lg:flex"
      >
        {desktopLinks.map((item) => {
          const active = isActivePath(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenus}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              {item.label}
            </Link>
          )
        })}

        {desktopDropdowns.map((dropdown) => {
          const open = openDropdown === dropdown.id
          const sectionActive = dropdown.items.some((item) => isActivePath(pathname, item.href))
          const panelId = `nav-dropdown-${dropdown.id}`
          return (
            <div key={dropdown.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(open ? null : dropdown.id)}
                aria-expanded={open}
                aria-controls={panelId}
                className={`flex items-center gap-1 ${tabClass(sectionActive)}`}
              >
                {dropdown.label}
                <svg
                  viewBox="0 0 20 20"
                  className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                </svg>
              </button>

              {open && (
                <ul
                  id={panelId}
                  className="absolute left-0 top-full z-20 mt-2 w-52 animate-fade-in-up space-y-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg motion-reduce:animate-none"
                >
                  {dropdown.items.map((item) => {
                    const active = isActivePath(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenus}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none ${
                            active ? 'bg-slate-900 font-medium text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

        <Link
          href={settingsItem.href}
          aria-current={isActivePath(pathname, settingsItem.href) ? 'page' : undefined}
          className={`ml-auto whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 motion-reduce:transition-none ${
            isActivePath(pathname, settingsItem.href)
              ? 'bg-slate-900 text-white shadow-sm'
              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {settingsItem.label}
        </Link>
      </nav>

      {/* Mobile / tablet navigation */}
      {menuOpen && (
        <nav
          id="dashboard-mobile-menu"
          aria-label="Main"
          className="rounded-2xl border border-slate-200 bg-black p-3 shadow-sm lg:hidden"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[...navGroups, { title: 'Company', items: [settingsItem] }].map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenus}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
                            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <form action="/logout" method="post" className="mt-3 border-t border-slate-200 pt-3">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-slate-800 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              Sign out
            </button>
          </form>
        </nav>
      )}
    </header>
  )
}
