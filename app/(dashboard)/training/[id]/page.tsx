import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { GraduationCap, ArrowLeft, Target } from "lucide-react"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { getSkillCatalog } from "@/lib/hr/skill-matrix"
import { getTranslator } from "@/lib/i18n/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await extractTenantContext()
  if (!ctx) redirect("/auth/login")
  const { t } = await getTranslator()

  const catalog = await getSkillCatalog(ctx.organizationId)
  const skill = catalog.find((s) => s.id === id)
  if (!skill) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AnimatedGroup className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-2">
        <Link href="/skill-matrix">
          <ArrowLeft className="h-4 w-4" />
          {t("skillMatrix.page.title")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{skill.name}</CardTitle>
              <CardDescription className="capitalize">{t(`skillMatrix.page.categories.${skill.category}`)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("skillMatrix.page.expected")}:</span>
            <Badge variant="outline" className="capitalize">{t(`skillMatrix.page.levels.${skill.expectedLevel}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("training.page.noResourceYet")}</p>
        </CardContent>
      </Card>
      </AnimatedGroup>
    </div>
  )
}
