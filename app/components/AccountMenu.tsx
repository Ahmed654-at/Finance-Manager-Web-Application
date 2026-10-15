'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { buttonSecondary } from '../dashboard/components/buttonStyles'

/**
 * Avatar + name button that opens an account menu (Account settings when available, Change password),
 * plus the Sign out button. Shared by the dashboard top bar and the employee header so both match.
 * Only the name is shown, never the email.
 */
export default function AccountMenu({
  displayName,
  settingsHref,
  onOpen,
}: {
  displayName: string
  /** Omit for users who cannot open Settings (employees). */
  settingsHref?: string
  /** Lets the parent close its own menus when this one opens. */
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || displayName.slice(0, 2).toUpperCase()

  // Escape or a click outside closes the menu.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const itemClass =
    'block px-4 py-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100 motion-reduce:transition-none'

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!open) onOpen?.()
            setOpen((value) => !value)
          }}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls="account-menu"
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
            className={`hidden h-4 w-4 text-slate-400 transition-transform duration-200 motion-reduce:transition-none md:block ${open ? 'rotate-180' : ''}`}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
          </svg>
        </button>

        {open && (
          <div
            id="account-menu"
            role="menu"
            className="absolute right-0 z-20 mt-2 w-56 animate-fade-in-up overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg motion-reduce:animate-none"
          >
            <p className="truncate border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
              {displayName}
            </p>
            {settingsHref && (
              <Link href={settingsHref} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                Account settings
              </Link>
            )}
            <Link href="/account/password" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              Change password
            </Link>
            {/* On small screens Sign out lives here; on desktop it is the button next to the menu. */}
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
        <button type="submit" className={buttonSecondary}>
          Sign out
        </button>
      </form>
    </>
  )
}
