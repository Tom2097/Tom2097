import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getSkillCatalog, getTeamAssessments, getTeamMembers, assessSkill } from '@/lib/hr/skill-matrix'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const include = searchParams.get('include')

    const catalog = await getSkillCatalog(organizationId)

    const result: Record<string, unknown> = { catalog }
    if (include === 'assessments') {
      const [assessments, teamMembers] = await Promise.all([
        getTeamAssessments(organizationId),
        getTeamMembers(organizationId),
      ])
      result.assessments = assessments
      result.teamMembers = teamMembers
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { userId, skillId, level } = await request.json()

    if (!userId || !skillId || !level) {
      return NextResponse.json(
        { error: 'userId, skillId, and level are required' },
        { status: 400 }
      )
    }

    const validLevels = ['beginner', 'intermediate', 'advanced', 'expert']
    if (!validLevels.includes(level)) {
      return NextResponse.json(
        { error: 'level must be one of: beginner, intermediate, advanced, expert' },
        { status: 400 }
      )
    }

    const assessment = await assessSkill(organizationId, userId, skillId, level)
    return NextResponse.json({ success: true, assessment })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
