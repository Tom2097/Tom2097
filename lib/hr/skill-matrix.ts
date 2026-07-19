import { createServiceClient } from "@/lib/supabase/service"

export interface Skill {
  id: string
  name: string
  category: 'technical' | 'domain' | 'soft' | 'compliance'
  expectedLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export interface SkillAssessment {
  userId: string
  skillId: string
  actualLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  lastAssessed: string
  notes?: string
}

export interface GapAnalysis {
  skillId: string
  skillName: string
  category: string
  expectedLevel: string
  actualLevel: string
  gap: 'none' | 'small' | 'medium' | 'large'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface TeamMember {
  id: string
  name: string
}

const LEVEL_ORDER: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
}

function computeGap(expected: string, actual: string): GapAnalysis['gap'] {
  const diff = (LEVEL_ORDER[expected] ?? 0) - (LEVEL_ORDER[actual] ?? 0)
  if (diff <= 0) return 'none'
  if (diff === 1) return 'small'
  if (diff === 2) return 'medium'
  return 'large'
}

function computePriority(gap: GapAnalysis['gap'], expected: string): GapAnalysis['priority'] {
  const baseExpected = LEVEL_ORDER[expected] ?? 0
  if (gap === 'none') return 'low'
  if (gap === 'small') return baseExpected >= 4 ? 'medium' : 'low'
  if (gap === 'medium') return baseExpected >= 3 ? 'high' : 'medium'
  if (gap === 'large') return baseExpected >= 2 ? 'critical' : 'high'
  return 'low'
}

/**
 * Seed catalog used the first time an organization opens the skill matrix
 * (see getSkillCatalog). Each org gets its own copy of these rows inserted
 * into hr_skill_catalog -- from then on it's real per-tenant data that an
 * org can grow/edit independently, not a shared constant every tenant reads.
 */
const DEFAULT_SKILLS: Array<{ name: string; category: Skill['category']; expectedLevel: Skill['expectedLevel'] }> = [
  { name: 'Machine Learning', category: 'technical', expectedLevel: 'advanced' },
  { name: 'Data Engineering', category: 'technical', expectedLevel: 'advanced' },
  { name: 'Cloud Infrastructure', category: 'technical', expectedLevel: 'intermediate' },
  { name: 'Cybersecurity', category: 'technical', expectedLevel: 'intermediate' },
  { name: 'Pharmaceutical QA', category: 'domain', expectedLevel: 'expert' },
  { name: 'Regulatory Affairs', category: 'domain', expectedLevel: 'expert' },
  { name: 'Supply Chain Ops', category: 'domain', expectedLevel: 'intermediate' },
  { name: 'Clinical Trials', category: 'domain', expectedLevel: 'advanced' },
  { name: 'Cross-functional Communication', category: 'soft', expectedLevel: 'intermediate' },
  { name: 'Leadership', category: 'soft', expectedLevel: 'advanced' },
  { name: 'Change Management', category: 'soft', expectedLevel: 'intermediate' },
  { name: 'Conflict Resolution', category: 'soft', expectedLevel: 'beginner' },
  { name: 'GDPR Compliance', category: 'compliance', expectedLevel: 'advanced' },
  { name: 'FDA Part 11', category: 'compliance', expectedLevel: 'expert' },
  { name: 'ISO 27001', category: 'compliance', expectedLevel: 'intermediate' },
  { name: 'SOC 2', category: 'compliance', expectedLevel: 'intermediate' },
]

function rowToSkill(row: { id: string; name: string; category: string; expected_level: string }): Skill {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Skill['category'],
    expectedLevel: row.expected_level as Skill['expectedLevel'],
  }
}

/** Get (and lazily seed) an organization's real skill catalog. */
export async function getSkillCatalog(orgId: string): Promise<Skill[]> {
  const db = createServiceClient()
  const { data: existing } = await db
    .from('hr_skill_catalog')
    .select('id, name, category, expected_level')
    .eq('organization_id', orgId)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (existing && existing.length > 0) {
    return existing.map(rowToSkill)
  }

  // First time this org has opened the skill matrix: seed its own copy of
  // the default catalog so it has real rows to assess against.
  const { data: inserted, error } = await db
    .from('hr_skill_catalog')
    .insert(
      DEFAULT_SKILLS.map((s) => ({
        organization_id: orgId,
        name: s.name,
        category: s.category,
        expected_level: s.expectedLevel,
      })),
    )
    .select('id, name, category, expected_level')

  if (error || !inserted) return []
  return inserted.map(rowToSkill)
}

/** Real team members for the assessment picker: the org's actual roster. */
export async function getTeamMembers(orgId: string): Promise<TeamMember[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true })

  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || p.id,
  }))
}

/** Persist a skill assessment for real (survives restarts/redeploys). */
export async function assessSkill(orgId: string, userId: string, skillId: string, level: string): Promise<SkillAssessment> {
  const db = createServiceClient()
  const lastAssessed = new Date().toISOString().slice(0, 10)

  const { data, error } = await db
    .from('hr_skill_assessments')
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        skill_id: skillId,
        actual_level: level,
        last_assessed: lastAssessed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,user_id,skill_id' },
    )
    .select('user_id, skill_id, actual_level, last_assessed, notes')
    .single()

  if (error || !data) {
    throw new Error(`Failed to save skill assessment: ${error?.message ?? 'unknown error'}`)
  }

  return {
    userId: data.user_id,
    skillId: data.skill_id,
    actualLevel: data.actual_level as SkillAssessment['actualLevel'],
    lastAssessed: data.last_assessed,
    notes: data.notes ?? undefined,
  }
}

export async function getTeamAssessments(orgId: string): Promise<SkillAssessment[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('hr_skill_assessments')
    .select('user_id, skill_id, actual_level, last_assessed, notes')
    .eq('organization_id', orgId)

  return (
    (data ?? []) as Array<{ user_id: string; skill_id: string; actual_level: string; last_assessed: string; notes: string | null }>
  ).map((a) => ({
    userId: a.user_id,
    skillId: a.skill_id,
    actualLevel: a.actual_level as SkillAssessment['actualLevel'],
    lastAssessed: a.last_assessed,
    notes: a.notes ?? undefined,
  }))
}

export async function analyzeGaps(orgId: string): Promise<GapAnalysis[]> {
  const [catalog, assessments] = await Promise.all([getSkillCatalog(orgId), getTeamAssessments(orgId)])
  const gaps: GapAnalysis[] = []
  for (const skill of catalog) {
    const skillAssessments = assessments.filter((a) => a.skillId === skill.id)
    if (skillAssessments.length === 0) continue
    const avgLevel = skillAssessments.reduce((sum, a) => sum + (LEVEL_ORDER[a.actualLevel] ?? 0), 0) / skillAssessments.length
    const avgLevelKey = Object.entries(LEVEL_ORDER).reduce((best, [key, val]) =>
      Math.abs(val - Math.round(avgLevel)) < Math.abs(LEVEL_ORDER[best] - Math.round(avgLevel)) ? key : best
    , 'beginner')
    const gap = computeGap(skill.expectedLevel, avgLevelKey)
    gaps.push({
      skillId: skill.id,
      skillName: skill.name,
      category: skill.category,
      expectedLevel: skill.expectedLevel,
      actualLevel: avgLevelKey,
      gap,
      priority: computePriority(gap, skill.expectedLevel),
    })
  }
  return gaps.sort((a, b) => {
    const order = ['critical', 'high', 'medium', 'low']
    return order.indexOf(a.priority) - order.indexOf(b.priority)
  })
}

export function getRecommendedTraining(gaps: GapAnalysis[]): string[] {
  const recommendations: string[] = []
  for (const g of gaps) {
    if (g.priority === 'critical' || g.priority === 'high') {
      recommendations.push(`Advanced ${g.skillName} certification — gap: ${g.gap}`)
    } else if (g.priority === 'medium') {
      recommendations.push(`Intermediate ${g.skillName} workshop — gap: ${g.gap}`)
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('No critical training gaps identified')
  }
  return recommendations
}
