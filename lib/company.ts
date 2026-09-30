import { SupabaseClient, User } from '@supabase/supabase-js'

export type CompanyData = {
  id: string
  name: string
  currency: string
  email: string | null
  phone: string | null
  address: string | null
  created_by?: string | null
}

export type CompanyContext = {
  company: CompanyData
  companyId: string
  role: string
}

/**
 * Retrieves or automatically initializes the single company context for the authenticated user.
 * Ensures the single company exists and that the user is connected as a member.
 */
export async function getCompanyContext(
  supabase: SupabaseClient,
  user: User
): Promise<CompanyContext> {
  // 1. Check if the user already has an existing membership
  const { data: memberRecord } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) // newest membership wins, so an invite beats an auto-created company
    .limit(1)
    .maybeSingle()

  if (memberRecord?.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', memberRecord.company_id)
      .maybeSingle()

    if (company) {
      if (company.name === 'Company Finance') {
        await supabase.from('companies').update({ name: 'Company Finance Manager' }).eq('id', company.id)
        company.name = 'Company Finance Manager'
      }
      await ensureDefaultCategories(supabase, company.id)
      return {
        company,
        companyId: company.id,
        role: memberRecord.role || 'owner',
      }
    }
  }

  // 2. No membership: this user gets their own, separate company and becomes its owner.
  // Existing companies are never joined automatically; teammates are added from the Team page.
  const { data: createdCompany, error: createError } = await supabase
    .from('companies')
    .insert({
      name: 'Company Finance Manager',
      currency: 'USD',
      created_by: user.id,
    })
    .select('*')
    .single()

  if (createError || !createdCompany) {
    throw new Error('Unable to create company for this account.')
  }

  const { error: memberError } = await supabase.from('company_members').insert({
    company_id: createdCompany.id,
    user_id: user.id,
    role: 'owner',
  })

  if (memberError) {
    throw new Error('Unable to link this account to its company.')
  }

  await ensureDefaultCategories(supabase, createdCompany.id)

  return {
    company: createdCompany,
    companyId: createdCompany.id,
    role: 'owner',
  }
}

const WRITE_ROLES = ['owner', 'admin', 'accountant']

/** Roles allowed to create, edit or delete financial records. Viewers are read-only. */
export function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role)
}

export const READ_ONLY_ERROR = 'Your role is read-only. You do not have permission to make changes.'

export const DEFAULT_AI_COMPANY_CATEGORIES = [
  // Primary Business Expense Categories
  { name: 'Marketing', type: 'expense', description: 'Marketing campaigns, advertising, sponsorships, lead generation' },
  { name: 'Employees Salaries', type: 'expense', description: 'Monthly engineering and staff payroll salaries' },
  { name: 'Team Travelling', type: 'expense', description: 'Business travel, flights, transit, hotel and client visits' },
  { name: 'Team Lunch', type: 'expense', description: 'Team lunches, catering, refreshments and meals' },

  // AI & Tech Company Income Streams
  { name: 'AI Services & Solutions', type: 'income', description: 'Custom AI development, prompt systems, integrations' },
  { name: 'Product Selling & Licenses', type: 'income', description: 'Sales from digital software products, templates, SaaS' },
  { name: 'AI Consulting & Retainers', type: 'income', description: 'Advisory, workshops, monthly client retainers' },

  // Operational Expenses
  { name: 'AI & Cloud Infrastructure', type: 'expense', description: 'OpenAI/Anthropic APIs, AWS/RunPod GPU instances, Vercel' },
  { name: 'Software & Subscriptions', type: 'expense', description: 'GitHub Copilot, Cursor, Notion, Slack, Figma' },
  { name: 'Office Rent & Utilities', type: 'expense', description: 'Co-working space, electricity, internet' },
] as const

export async function ensureDefaultCategories(supabase: SupabaseClient, companyId: string) {
  try {
    const { data: existing } = await supabase
      .from('categories')
      .select('name')
      .eq('company_id', companyId)

    const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name.toLowerCase()))

    const toInsert = DEFAULT_AI_COMPANY_CATEGORIES.filter(
      (c) => !existingNames.has(c.name.toLowerCase())
    ).map((c) => ({
      company_id: companyId,
      name: c.name,
      type: c.type,
      description: c.description,
    }))

    if (toInsert.length > 0) {
      await supabase.from('categories').insert(toInsert)
    }
  } catch {
    // Graceful fallback if categories table is not yet populated
  }
}

