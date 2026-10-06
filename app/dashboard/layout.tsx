import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyContext } from '@/lib/company'
import { getAccountName } from '@/lib/user'
import DashboardNav from './components/DashboardNav'

// Shared shell for every dashboard page: the menu is rendered once here, so it appears on all pages.
// Employees only get the "My Expenses" page; everything under /dashboard is for staff.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, company } = await getCompanyContext(supabase, user)
  if (role === 'employee') {
    redirect('/my-expenses')
  }

  const accountName = await getAccountName(supabase, user)

  return (
    <div className="min-h-screen bg-black text-slate-900">
      {/* Padding sits outside the max-width, exactly like each page's <main>, so the menu and page share one left edge. */}
      <div className="px-4 pt-4 sm:pt-6">
        <div className="mx-auto max-w-6xl">
          <DashboardNav companyName={company.name} userEmail={user.email} accountName={accountName} />
        </div>
      </div>
      {children}
    </div>
  )
}
