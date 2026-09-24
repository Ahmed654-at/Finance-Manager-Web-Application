import { createClient } from '@/lib/supabase/server'

export async function logAudit(params: {
  companyId: string
  userId: string
  action: string
  entityType: string
  entityId?: string | null
  summary: string
}) {
  const supabase = await createClient()

  try {
    await supabase.from('audit_logs').insert({
      company_id: params.companyId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      summary: params.summary,
    })
  } catch (error) {
    console.error('Failed to log audit entry:', error)
  }
}
