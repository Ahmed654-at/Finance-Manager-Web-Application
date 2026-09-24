import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: string | number | null | undefined) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const type = searchParams.get('type') ?? ''
  const categoryIdFilter = searchParams.get('category_id') ?? ''
  const accountIdFilter = searchParams.get('account_id') ?? ''
  const search = searchParams.get('search') ?? ''

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

  let query = supabase
    .from('transactions')
    .select('*, categories(name), accounts(name)')
    .eq('company_id', companyId)

  if (from) {
    query = query.gte('transaction_date', from)
  }

  if (to) {
    query = query.lte('transaction_date', to)
  }

  if (type && ['income', 'expense'].includes(type)) {
    query = query.eq('type', type)
  }

  if (categoryIdFilter) {
    query = query.eq('category_id', categoryIdFilter)
  }

  if (accountIdFilter) {
    query = query.eq('account_id', accountIdFilter)
  }

  if (search) {
    query = query.ilike('description', `%${search}%`)
  }

  const { data: transactionRows } = await query.order('transaction_date', { ascending: false })

  const rows = (transactionRows ?? []) as Array<{
    transaction_date: string
    categories?: { name: string } | null
    accounts?: { name: string } | null
    description: string | null
    amount: number | string | null
    type: 'income' | 'expense'
  }>

  const csvLines = [
    ['Date', 'Category', 'Account', 'Description', 'Amount', 'Type'].map(csvEscape).join(','),
    ...rows.map((row) => {
      const categoryName = row.categories?.name || 'Uncategorized'
      const accountName = row.accounts?.name || '—'
      const description = row.description || ''
      const amount = Number(row.amount || 0)

      return [
        row.transaction_date || '',
        categoryName,
        accountName,
        description,
        amount,
        row.type,
      ]
        .map(csvEscape)
        .join(',')
    }),
  ]

  const csv = csvLines.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="transactions-export.csv"',
    },
  })
}
