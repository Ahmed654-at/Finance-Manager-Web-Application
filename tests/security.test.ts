import { describe, expect, it } from 'vitest'
import { csvCell, isIsoDate, isSupportedCurrency, safeHttpUrl } from '@/lib/security'

describe('safeHttpUrl', () => {
  it('accepts http and https links', () => {
    expect(safeHttpUrl('https://example.com/receipt.pdf')).toBe('https://example.com/receipt.pdf')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
  })

  it('rejects script-running and other schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHttpUrl('ftp://example.com/file')).toBeNull()
  })

  it('rejects empty and malformed values', () => {
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
  })
})

describe('csvCell', () => {
  it('quotes text and doubles embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+1+1')).toBe('"\'+1+1"')
    expect(csvCell('-2+3')).toBe('"\'-2+3"')
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
  })

  it('leaves numbers, including negatives, unchanged', () => {
    expect(csvCell(-50)).toBe('-50')
    expect(csvCell(12.5)).toBe('12.5')
  })

  it('treats null and undefined as empty', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
})

describe('isIsoDate', () => {
  it('accepts real dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })

  it('rejects impossible or badly formatted dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('28/02/2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('isSupportedCurrency', () => {
  it('only accepts listed currencies', () => {
    expect(isSupportedCurrency('PKR')).toBe(true)
    expect(isSupportedCurrency('XYZ')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})
