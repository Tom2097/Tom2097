import { getTranslator } from "@/lib/i18n/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

export default async function LoginCheckPage() {
  const { t } = await getTranslator()
  const results: string[] = []

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      results.push(`getUser: FAILED — ${userError?.message || "null user"}`)
    } else {
      results.push(`getUser: OK — ${user.email} (${user.id})`)
    }

    if (user) {
      const serviceDb = createServiceClient()
      const { data: profile, error: profileError } = await serviceDb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError || !profile) {
        results.push(`profile: MISSING — ${profileError?.message || "not found"}`)
      } else {
        results.push(`profile: FOUND — org:${profile.organization_id} role:${profile.role}`)

        const { data: org, error: orgError } = await serviceDb
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .maybeSingle()

        if (orgError || !org) {
          results.push(`org: MISSING — ${orgError?.message || "not found"}`)
        } else {
          results.push(`org: FOUND — ${org.name} plan:${org.plan_id}`)
        }
      }
    }
  } catch (err) {
    results.push(`EXCEPTION: ${err instanceof Error ? err.message : String(err)}`)
  }

  return (
    <div style={{ position: "relative", background: "#111", color: "#0f0", minHeight: "100vh", padding: 40, fontFamily: "monospace" }}>
      <AuroraBackground />
      <AnimatedGroup>
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>🔍 Login Check v2</h1>
      </AnimatedGroup>
      {results.map((r, i) => (
        <div key={i} style={{ marginBottom: 8, fontSize: 16 }}>• {r}</div>
      ))}
      <div style={{marginTop:20}}>
        <a href="/" style={{color:"#0ff",fontSize:18}}>{t("loginCheck.page.goToDashboard")}</a>
      </div>
    </div>
  )
}
