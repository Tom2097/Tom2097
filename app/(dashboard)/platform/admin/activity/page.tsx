import Link from "next/link"
import { notFound } from "next/navigation"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 200

interface ActivityRow {
  id: number
  created_at: string
  user_id: string
  kind: "page" | "api"
  method: string
  path: string
  query: string | null
  ip_address: string | null
  user_agent: string | null
}

interface Search {
  email?: string
  kind?: string
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function deviceOf(ua: string | null): string {
  if (!ua) return "-"
  if (/mobile|android|iphone/i.test(ua)) return "Mobile"
  if (/ipad|tablet/i.test(ua)) return "Tablet"
  return "Desktop"
}

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await isCurrentUserPlatformOwner())) notFound()

  const { email = "", kind = "" } = await searchParams
  const db = createServiceClient()

  let userFilter: string[] | null = null
  if (email.trim()) {
    const { data: matches } = await db
      .from("profiles")
      .select("id")
      .ilike("email", `%${email.trim().replace(/[%_]/g, "")}%`)
      .limit(50)
    userFilter = (matches ?? []).map((m) => m.id as string)
  }

  let rows: ActivityRow[] = []
  if (userFilter === null || userFilter.length > 0) {
    let query = db
      .from("activity_logs")
      .select("id, created_at, user_id, kind, method, path, query, ip_address, user_agent")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
    if (userFilter) query = query.in("user_id", userFilter)
    if (kind === "page" || kind === "api") query = query.eq("kind", kind)
    const { data } = await query
    rows = (data ?? []) as ActivityRow[]
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] }
  const who = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const { count: last24h } = await db
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hoursAgoIso(24))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every page visit and API call by signed-in users. Kept for 90 days. {last24h ?? 0} events in the last 24 hours.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Search by user email, or show only pages or only API calls.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3" method="get">
            <input
              name="email"
              defaultValue={email}
              placeholder="user@example.com"
              className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
            />
            <select
              name="kind"
              defaultValue={kind}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Pages and API calls</option>
              <option value="page">Pages only</option>
              <option value="api">API calls only</option>
            </select>
            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Apply
            </button>
            {(email || kind) && (
              <Link href="/platform/admin/activity" className="text-sm text-muted-foreground underline">
                Clear
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest {rows.length} events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity matches.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time (UTC)</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const p = who.get(r.user_id)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.created_at.slice(0, 19).replace("T", " ")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link
                          href={`/platform/admin/activity?email=${encodeURIComponent(p?.email ?? "")}`}
                          className="hover:underline"
                        >
                          {p?.full_name || p?.email || r.user_id.slice(0, 8)}
                        </Link>
                        {p?.full_name && p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.kind === "api" ? "secondary" : "outline"}>
                          {r.kind === "api" ? r.method : "Page"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md break-all font-mono text-xs">
                        {r.path}
                        {r.query && <span className="text-muted-foreground">?{r.query}</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.ip_address ?? "-"}</TableCell>
                      <TableCell className="text-xs">{deviceOf(r.user_agent)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
