import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const formData = await request.formData()
  const name = formData.get('name') as string
  const currency = (formData.get('currency') as string) || 'PKR'

  if (!name || name.trim().length === 0) {
    redirect('/onboarding?error=Company name is required')
  }

  // 1. Create the company
const { data: company, error: companyError } = await supabase
  .from('companies')
  .insert({ name: name.trim(), currency, created_by: user.id })
  .select()
  .single()

  if (companyError || !company) {
    redirect('/onboarding?error=Could not create company')
  }

  // 2. Add the current user as the owner
  const { error: memberError } = await supabase
    .from('company_members')
    .insert({
      company_id: company.id,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    redirect('/onboarding?error=Could not link you to the company')
  }

  redirect('/dashboard')
}
