import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function checkBudgetAlerts(companyId: string, categoryId: string) {
  if (!supabaseAdmin) {
    return
  }

  const supabase = await createClient()
  const today = new Date()
  const todayString = today.toISOString().slice(0, 10)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('company_id', companyId)
    .eq('category_id', categoryId)
    .lte('start_date', todayString)
    .gte('end_date', todayString)

  if (!budgets || budgets.length === 0) {
    return
  }

  const { data: companyMembers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)

  if (!companyMembers || companyMembers.length === 0) {
    return
  }

  for (const budget of budgets) {
    const budgetAmount = Number(budget.amount || 0)
    const { data: spendRows } = await supabase
      .from('transactions')
      .select('amount')
      .eq('company_id', companyId)
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('transaction_date', budget.start_date)
      .lte('transaction_date', budget.end_date)

    const actualSpend = (spendRows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)

    if (budgetAmount <= 0) {
      continue
    }

    let message: string | null = null

    if (actualSpend >= budgetAmount) {
      const actualValue = Number(actualSpend).toFixed(2)
      const budgetValue = Number(budgetAmount).toFixed(2)
      message = `Budget '${budget.name}' has been fully spent (${actualValue}/${budgetValue})`
    } else if (actualSpend >= budgetAmount * 0.8) {
      const percent = Math.min(100, Math.round((actualSpend / budgetAmount) * 100))
      message = `Budget '${budget.name}' is at ${percent}% of its limit`
    }

    if (!message) {
      continue
    }

    for (const member of companyMembers) {
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', member.user_id)
        .eq('message', message)
        .gte('created_at', startOfToday)

      if (existingNotifications && existingNotifications.length > 0) {
        continue
      }

      const { error: notificationInsertError } = await supabase.from('notifications').insert({
        company_id: companyId,
        user_id: member.user_id,
        message,
        is_read: false,
      })

      if (notificationInsertError) {
        continue
      }

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
      const email = userData?.user?.email

      if (!userError && email) {
        await sendNotificationEmail(email, 'Budget Alert', message)
      }
    }
  }
}
