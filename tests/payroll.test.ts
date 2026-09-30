import { describe, expect, it } from 'vitest'
import { readPayrollDetails } from '@/lib/payroll'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('readPayrollDetails', () => {
  it('returns null when no payroll field is filled, so only a login is created', () => {
    expect(readPayrollDetails(form({}))).toBeNull()
    expect(readPayrollDetails(form({ designation: '  ', salary_amount: '' }))).toBeNull()
  })

  it('reads and trims the provided details', () => {
    const details = readPayrollDetails(
      form({
        designation: '  Senior AI Engineer ',
        department: 'Product Engineering',
        salary_amount: '5000',
        payment_method: 'cash',
        bank_account_details: ' IBAN 123 ',
      }),
    )

    expect(details).toEqual({
      designation: 'Senior AI Engineer',
      department: 'Product Engineering',
      salaryAmount: 5000,
      paymentMethod: 'cash',
      bankAccountDetails: 'IBAN 123',
    })
  })

  it('rounds the salary to cents', () => {
    expect(readPayrollDetails(form({ salary_amount: '1234.567' }))?.salaryAmount).toBe(1234.57)
  })

  it('falls back to safe defaults for missing department and unknown payment method', () => {
    const details = readPayrollDetails(form({ salary_amount: '100', payment_method: 'bitcoin-atm' }))
    expect(details?.department).toBe('AI Services')
    expect(details?.paymentMethod).toBe('bank_transfer')
    expect(details?.bankAccountDetails).toBeNull()
  })

  it('never returns a negative or invalid salary', () => {
    expect(readPayrollDetails(form({ salary_amount: '-50' }))?.salaryAmount).toBe(0)
    expect(readPayrollDetails(form({ salary_amount: 'abc' }))?.salaryAmount).toBe(0)
  })
})
