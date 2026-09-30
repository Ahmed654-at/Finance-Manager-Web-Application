import { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Resolves the display account name for the authenticated user.
 * Checks user metadata first, employee records second, and falls back to a clean formatted email name.
 */
export async function getAccountName(supabase: SupabaseClient, user: User): Promise<string> {
  // 1. Check user_metadata
  const meta = user.user_metadata || {}
  const candidate = meta.full_name || meta.name || meta.display_name
  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim()
  }

  if (meta.first_name || meta.last_name) {
    const combined = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()
    if (combined) return combined
  }

  // 2. Check if user has an employee record with matching email
  if (user.email) {
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('name')
        .eq('email', user.email)
        .limit(1)
        .maybeSingle()

      if (employee?.name && typeof employee.name === 'string' && employee.name.trim()) {
        return employee.name.trim()
      }
    } catch {
      // Fallback if table not queried
    }
  }

  // 3. Smart format from email prefix
  if (user.email) {
    const prefix = user.email.split('@')[0] || ''
    const clean = prefix.replace(/[0-9]+$/g, '') // strip trailing digits (e.g. 61)

    if (clean.toLowerCase() === 'haseebshakeel') {
      return 'Haseeb Shakeel'
    }

    if (clean.includes('.') || clean.includes('_') || clean.includes('-')) {
      return clean
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
    }

    const spaced = clean.replace(/([a-z])([A-Z])/g, '$1 $2')
    if (spaced.includes(' ')) {
      return spaced
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }

    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
  }

  return 'Account'
}
