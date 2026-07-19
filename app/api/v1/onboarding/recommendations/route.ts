import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()
    const db = createServiceClient()

    if (body.action === 'feedback') {
      const { moduleId, helpful } = body as { moduleId?: string; helpful?: boolean }
      if (!moduleId || typeof helpful !== 'boolean') {
        return NextResponse.json({ error: 'moduleId and helpful are required' }, { status: 400 })
      }

      const { data: profile } = await db.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()

      const { error } = await db.from('recommendation_feedback').insert({
        organization_id: profile?.organization_id ?? null,
        user_id: user.id,
        module_id: moduleId,
        helpful,
      })
      if (error) {
        return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === 'complete') {
      const { selectedModules, questionnaire } = body as {
        selectedModules?: string[]
        questionnaire?: Record<string, unknown>
      }
      const { error } = await db
        .from('profiles')
        .update({
          selected_modules: Array.isArray(selectedModules) ? selectedModules : [],
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
      }

      // Persist the questionnaire + identity-verification data collected in
      // app/onboarding/page.tsx, which previously only ever reached
      // localStorage ("digit_questionnaire") and never the server.
      if (questionnaire && typeof questionnaire === 'object') {
        const { data: profile } = await db
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle()

        const q = questionnaire as Record<string, unknown>
        const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

        const { error: responseError } = await db.from('onboarding_responses').upsert(
          {
            user_id: user.id,
            organization_id: profile?.organization_id ?? null,
            industry: typeof q.industry === 'string' ? q.industry : null,
            sub_industry: typeof q.subIndustry === 'string' ? q.subIndustry : null,
            company_size: typeof q.companySize === 'string' ? q.companySize : null,
            employee_count_range: typeof q.employeeCountRange === 'string' ? q.employeeCountRange : null,
            annual_revenue_range: typeof q.annualRevenueRange === 'string' ? q.annualRevenueRange : null,
            business_stage: typeof q.businessStage === 'string' ? q.businessStage : null,
            geographic_scope: typeof q.geographicScope === 'string' ? q.geographicScope : null,
            primary_goals: asStringArray(q.primaryGoals),
            current_challenges: asStringArray(q.currentChallenges),
            warmup_response: typeof q.warmupResponse === 'string' ? q.warmupResponse : null,
            technical_maturity: typeof q.technicalMaturity === 'string' ? q.technicalMaturity : null,
            existing_tools: asStringArray(q.existingTools),
            budget_range: typeof q.budgetRange === 'string' ? q.budgetRange : null,
            timeline_urgency: typeof q.timelineUrgency === 'string' ? q.timelineUrgency : null,
            compliance_requirements: asStringArray(q.complianceRequirements),
            full_legal_name: typeof q.fullLegalName === 'string' ? q.fullLegalName : null,
            government_id_type: typeof q.governmentIdType === 'string' ? q.governmentIdType : null,
            company_registration_number: typeof q.companyRegistrationNumber === 'string' ? q.companyRegistrationNumber : null,
            verified_domain: typeof q.verifiedDomain === 'string' ? q.verifiedDomain : null,
            terms_accepted_at: q.acceptedTerms === true ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

        if (responseError) {
          // Module selection already succeeded above; don't fail the whole
          // request over the supplementary questionnaire record.
          console.error('[onboarding/complete] failed to persist onboarding_responses:', responseError.message)
        }
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
