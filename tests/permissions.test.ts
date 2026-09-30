import { describe, expect, it } from 'vitest'
import { canWrite, DEFAULT_AI_COMPANY_CATEGORIES, READ_ONLY_ERROR } from '@/lib/company'

describe('canWrite (role permissions)', () => {
  it.each(['owner', 'admin', 'accountant'])('allows %s to change financial data', (role) => {
    expect(canWrite(role)).toBe(true)
  })

  it.each(['viewer', 'employee', 'member', '', 'unknown-role'])('blocks %s from changing financial data', (role) => {
    expect(canWrite(role)).toBe(false)
  })

  it('is case sensitive so a spoofed role string is not accepted', () => {
    expect(canWrite('Owner')).toBe(false)
    expect(canWrite('ADMIN')).toBe(false)
  })

  it('exposes a clear read-only error message', () => {
    expect(READ_ONLY_ERROR).toMatch(/read-only/i)
  })
})

describe('default categories', () => {
  it('has unique names and only income/expense types', () => {
    const names = DEFAULT_AI_COMPANY_CATEGORIES.map((c) => c.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    for (const category of DEFAULT_AI_COMPANY_CATEGORIES) {
      expect(['income', 'expense']).toContain(category.type)
    }
  })

  it('includes a salary category so payroll can be categorised', () => {
    expect(DEFAULT_AI_COMPANY_CATEGORIES.some((c) => /salar/i.test(c.name))).toBe(true)
  })
})
