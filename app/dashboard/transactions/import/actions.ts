'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext, canWrite, READ_ONLY_ERROR } from '@/lib/company'

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

export async function importTransactionsCsv(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  const { companyId, role } = await getCompanyContext(supabase, user)
  if (!canWrite(role)) return { error: READ_ONLY_ERROR }
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { error: 'No CSV file uploaded.' }
  }

  const csvText = await file.text()

  if (!csvText.trim()) {
    return { error: 'The uploaded CSV file is empty.' }
  }

  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (rows.length < 2) {
    return { error: 'CSV file must include a header row and at least one data row.' }
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('company_id', companyId)

  const categoryLookup = new Map(
    (categories ?? []).map((category) => [String(category.name).trim().toLowerCase(), category.id]),
  )

  let imported = 0
  let skipped = 0

  for (let i = 1; i < rows.length; i += 1) {
    const cells = parseCsvLine(rows[i])
    const values = [...cells, '', '', '', '', ''].slice(0, 5)
    const [date, type, categoryName, amountText, description] = values

    const normalizedType = String(type ?? '').trim().toLowerCase()
    const normalizedDate = String(date ?? '').trim()
    const amount = Number(amountText ?? '')

    if (!['income', 'expense'].includes(normalizedType) || !normalizedDate || !Number.isFinite(amount) || amount <= 0) {
      skipped += 1
      continue
    }

    const normalizedCategoryName = String(categoryName ?? '').trim()
    const categoryId = normalizedCategoryName
      ? categoryLookup.get(normalizedCategoryName.toLowerCase()) ?? null
      : null

    const { error: insertError } = await supabase.from('transactions').insert({
      company_id: companyId,
      type: normalizedType,
      amount,
      category_id: categoryId,
      description: String(description ?? '').trim() || null,
      transaction_date: normalizedDate,
      created_by: user.id,
    })

    if (!insertError) {
      imported += 1
    } else {
      skipped += 1
    }
  }

  revalidatePath('/dashboard/transactions')

  return { success: true, imported, skipped }
}
