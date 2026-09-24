import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: string | number) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replace(/"/g, '""')}"`
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)

function getMonthBounds(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from') || getMonthBounds().from
  const to = searchParams.get('to') || getMonthBounds().to

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return new Response('Not found', { status: 404 })
  }

  const companyId = membership.company_id

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: true })

  const records = transactions ?? []

  let csv = ''

  if (type === 'pnl') {
    const categoryTotals = new Map<string, { income: number; expense: number }>()

    records.forEach((row) => {
      const name = row.categories?.name || 'Uncategorized'
      const amount = Number(row.amount || 0)
      const key = name
      const current = categoryTotals.get(key) ?? { income: 0, expense: 0 }

      if (row.type === 'income') {
        current.income += amount
      } else {
        current.expense += amount
      }

      categoryTotals.set(key, current)
    })

    const rows: Array<{ category: string; type: string; total: number }> = []
    categoryTotals.forEach((totals, category) => {
      if (totals.income > 0) rows.push({ category, type: 'income', total: totals.income })
      if (totals.expense > 0) rows.push({ category, type: 'expense', total: totals.expense })
    })

    const totalIncome = records
      .filter((row) => row.type === 'income')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const totalExpenses = records
      .filter((row) => row.type === 'expense')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)

    csv = [
      ['Category', 'Type', 'Total'].join(','),
      ...rows.map((row) => [row.category, row.type, row.total].map(csvEscape).join(',')),
      ['Total Income', 'income', totalIncome].map(csvEscape).join(','),
      ['Total Expenses', 'expense', totalExpenses].map(csvEscape).join(','),
      ['Net Profit', 'net', totalIncome - totalExpenses].map(csvEscape).join(','),
    ].join('\n')
  } else {
    const periodMap = new Map<string, { income: number; expense: number }>()

    const dayDiff = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
    const useMonthly = dayDiff > 31

    records.forEach((row) => {
      const date = new Date(`${row.transaction_date}T00:00:00`)
      const key = useMonthly
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : formatDateInput(date)

      const current = periodMap.get(key) ?? { income: 0, expense: 0 }

      if (row.type === 'income') {
        current.income += Number(row.amount || 0)
      } else {
        current.expense += Number(row.amount || 0)
      }

      periodMap.set(key, current)
    })

    const rows = Array.from(periodMap.entries()).map(([period, totals]) => ({
      period,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }))

    csv = [
      ['Period', 'Income', 'Expenses', 'Net'].join(','),
      ...rows.map((row) => [row.period, row.income, row.expense, row.net].map(csvEscape).join(',')),
    ].join('\n')
  }

  const filename = `report-${type || 'pnl'}-${from}-to-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
