import { SUPPORTED_CURRENCIES } from '@/lib/currency'

/**
 * Returns the URL only if it is a plain http(s) link, otherwise null.
 * Blocks `javascript:`, `data:` and other schemes that would run code when the link is clicked.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Escapes one CSV cell. Text that starts with = + - @ (or a tab/CR) would be run as a formula by
 * Excel and Google Sheets, so it is prefixed with an apostrophe. Numbers are left untouched.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value)

  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((currency) => currency.code === code)
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
