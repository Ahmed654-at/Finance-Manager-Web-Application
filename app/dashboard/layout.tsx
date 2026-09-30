import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'

// Employees only get the "My Expenses" page; everything under /dashboard is for staff.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { role } = await getCompanyContext(supabase, user)
    if (role === 'employee') {
      redirect('/my-expenses')
    }
  }

  return children
}
