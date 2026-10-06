'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { buttonPrimary, buttonSecondary } from '../components/buttonStyles'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none'

/** "Reset password" button that opens a small panel with New password + Confirm password. */
export default function ResetPasswordButton({
  memberId,
  memberLabel,
  action,
}: {
  memberId: string
  memberLabel: string
  action: (formData: FormData) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const newId = useId()
  const confirmId = useId()

  // Focus the first field when the panel opens.
  useEffect(() => {
    if (open) firstFieldRef.current?.focus()
  }, [open])

  // Escape or a click outside closes the panel.
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setMismatch(false)
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className={buttonSecondary}
      >
        Reset password
      </button>

      {open && (
        <form
          id={panelId}
          action={action}
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget)
            if (data.get('password') !== data.get('confirm_password')) {
              event.preventDefault()
              setMismatch(true)
            }
          }}
          className="absolute right-0 top-full z-20 mt-2 w-72 animate-fade-in-up space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg motion-reduce:animate-none"
        >
          <p className="text-sm font-semibold text-slate-900">Reset password for {memberLabel}</p>
          <input type="hidden" name="memberId" value={memberId} />

          <div>
            <label htmlFor={newId} className="block text-xs font-medium text-slate-700">
              New password
            </label>
            <input
              ref={firstFieldRef}
              id={newId}
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="min 8 characters"
              onChange={() => setMismatch(false)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={confirmId} className="block text-xs font-medium text-slate-700">
              Confirm password
            </label>
            <input
              id={confirmId}
              name="confirm_password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              aria-invalid={mismatch}
              aria-describedby={mismatch ? `${confirmId}-error` : undefined}
              onChange={() => setMismatch(false)}
              className={inputClass}
            />
            {mismatch && (
              <p id={`${confirmId}-error`} role="alert" className="mt-1 text-xs text-red-400">
                The passwords do not match.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" className={buttonPrimary}>
              Save password
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
