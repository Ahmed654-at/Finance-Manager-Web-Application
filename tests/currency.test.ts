import { describe, expect, it } from 'vitest'
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency'

describe('formatCurrency', () => {
  it('formats US dollars with two decimals', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50')
  })

  it('defaults to USD when no currency is given', () => {
    expect(formatCurrency(10)).toBe('$10.00')
  })

  it('treats null, undefined and NaN-like input as zero', () => {
    expect(formatCurrency(null)).toBe('$0.00')
    expect(formatCurrency(undefined)).toBe('$0.00')
  })

  it('is case-insensitive for the currency code', () => {
    expect(formatCurrency(5, 'usd')).toBe('$5.00')
  })

  it('includes the amount for other supported currencies', () => {
    expect(formatCurrency(1000, 'PKR')).toContain('1,000.00')
    expect(formatCurrency(1000, 'EUR')).toContain('1,000.00')
  })

  it('falls back to a readable string for an invalid currency code', () => {
    expect(formatCurrency(5, 'NOT-A-CURRENCY')).toBe('NOT-A-CURRENCY 5.00')
  })

  it('lists each supported currency once', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
