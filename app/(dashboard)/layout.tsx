import { createClient } from '@/lib/supabase/server'
import { DashboardChrome } from '@/components/digit/dashboard-chrome'

// The (dashboard) route group also owns "/" (app/(dashboard)/page.tsx),
// which is the one page in this group a signed-out visitor can actually
// see rendered (every other page here redirects to /auth/login before
// render). The internal sidebar/navbar/AI-assistant chrome assumes a
// logged-in user, so it's skipped entirely for signed-out requests --
// the public landing page renders full-bleed instead.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  return <DashboardChrome>{children}</DashboardChrome>
}
