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

const CATALOGS: Record<string, Skill[]> = {
  org_default: [
    { id: 's1', name: 'Machine Learning', category: 'technical', expectedLevel: 'advanced' },
    { id: 's2', name: 'Data Engineering', category: 'technical', expectedLevel: 'advanced' },
    { id: 's3', name: 'Cloud Infrastructure', category: 'technical', expectedLevel: 'intermediate' },
    { id: 's4', name: 'Cybersecurity', category: 'technical', expectedLevel: 'intermediate' },
    { id: 's5', name: 'Pharmaceutical QA', category: 'domain', expectedLevel: 'expert' },
    { id: 's6', name: 'Regulatory Affairs', category: 'domain', expectedLevel: 'expert' },
    { id: 's7', name: 'Supply Chain Ops', category: 'domain', expectedLevel: 'intermediate' },
    { id: 's8', name: 'Clinical Trials', category: 'domain', expectedLevel: 'advanced' },
    { id: 's9', name: 'Cross-functional Communication', category: 'soft', expectedLevel: 'intermediate' },
    { id: 's10', name: 'Leadership', category: 'soft', expectedLevel: 'advanced' },
    { id: 's11', name: 'Change Management', category: 'soft', expectedLevel: 'intermediate' },
    { id: 's12', name: 'Conflict Resolution', category: 'soft', expectedLevel: 'beginner' },
    { id: 's13', name: 'GDPR Compliance', category: 'compliance', expectedLevel: 'advanced' },
    { id: 's14', name: 'FDA Part 11', category: 'compliance', expectedLevel: 'expert' },
    { id: 's15', name: 'ISO 27001', category: 'compliance', expectedLevel: 'intermediate' },
    { id: 's16', name: 'SOC 2', category: 'compliance', expectedLevel: 'intermediate' },
  ],
}

const ASSESSMENTS: Record<string, SkillAssessment[]> = {
  org_default: [
    { userId: 'u1', skillId: 's1', actualLevel: 'intermediate', lastAssessed: '2026-03-15', notes: 'Comfortable with regression models' },
    { userId: 'u1', skillId: 's5', actualLevel: 'advanced', lastAssessed: '2026-02-10' },
    { userId: 'u1', skillId: 's13', actualLevel: 'advanced', lastAssessed: '2026-01-20' },
    { userId: 'u2', skillId: 's2', actualLevel: 'expert', lastAssessed: '2026-04-01' },
    { userId: 'u2', skillId: 's3', actualLevel: 'advanced', lastAssessed: '2026-03-22' },
    { userId: 'u2', skillId: 's9', actualLevel: 'beginner', lastAssessed: '2026-02-28' },
    { userId: 'u3', skillId: 's6', actualLevel: 'expert', lastAssessed: '2026-03-10' },
    { userId: 'u3', skillId: 's14', actualLevel: 'advanced', lastAssessed: '2026-03-10' },
    { userId: 'u3', skillId: 's8', actualLevel: 'intermediate', lastAssessed: '2026-03-10' },
    { userId: 'u4', skillId: 's4', actualLevel: 'beginner', lastAssessed: '2026-04-05' },
    { userId: 'u4', skillId: 's10', actualLevel: 'intermediate', lastAssessed: '2026-03-18' },
    { userId: 'u4', skillId: 's15', actualLevel: 'beginner', lastAssessed: '2026-03-18' },
    { userId: 'u5', skillId: 's7', actualLevel: 'expert', lastAssessed: '2026-04-02' },
    { userId: 'u5', skillId: 's11', actualLevel: 'advanced', lastAssessed: '2026-03-25' },
    { userId: 'u5', skillId: 's16', actualLevel: 'intermediate', lastAssessed: '2026-03-25' },
  ],
}

const USERS = [
  { id: 'u1', name: 'Alice Chen' },
  { id: 'u2', name: 'Bob Martinez' },
  { id: 'u3', name: 'Carol Singh' },
  { id: 'u4', name: 'David Kim' },
  { id: 'u5', name: 'Eva Johansson' },
]

function getOrgKey(orgId: string): string {
  return `org_${orgId.slice(0, 8)}`
}

/**
 * Every org's key falls back to the shared demo catalog/assessments (this
 * whole module is a single shared in-memory dataset, not real per-tenant
 * data). The bug this fixed: getTeamAssessments/assessSkill used
 * `ASSESSMENTS[key] ?? []` -- for any real org that `[]` was a brand-new
 * array never written back to ASSESSMENTS, so assessSkill() mutated a copy
 * that vanished immediately and every subsequent read saw an empty list.
 * This ensures the org's entry actually exists in the dict before anyone
 * reads or mutates it, so the same array reference is reused.
 */
function ensureOrgData(orgId: string): string {
  const key = getOrgKey(orgId)
  if (!CATALOGS[key]) CATALOGS[key] = CATALOGS['org_default']
  if (!ASSESSMENTS[key]) ASSESSMENTS[key] = []
  return key
}

export function getSkillCatalog(orgId: string): Skill[] {
  const key = ensureOrgData(orgId)
  return CATALOGS[key]
}

export function getTeamMembers(_orgId: string): { id: string; name: string }[] {
  return USERS
}

export function assessSkill(orgId: string, userId: string, skillId: string, level: string): SkillAssessment {
  const key = ensureOrgData(orgId)
  const existing = ASSESSMENTS[key]
  const idx = existing.findIndex((a) => a.userId === userId && a.skillId === skillId)
  const assessment: SkillAssessment = {
    userId,
    skillId,
    actualLevel: level as SkillAssessment['actualLevel'],
    lastAssessed: new Date().toISOString().slice(0, 10),
  }
  if (idx >= 0) {
    existing[idx] = assessment
  } else {
    existing.push(assessment)
  }
  return assessment
}

export function getTeamAssessments(orgId: string): SkillAssessment[] {
  const key = ensureOrgData(orgId)
  return ASSESSMENTS[key]
}

export function analyzeGaps(orgId: string): GapAnalysis[] {
  const catalog = getSkillCatalog(orgId)
  const assessments = getTeamAssessments(orgId)
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
