"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Search,
  Users,
  UserCheck,
  Shield,
  PauseCircle,
  Eye,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

interface PlatformUser {
  id: string
  email: string
  full_name: string
  role: string
  status: string
  organization_name: string
  last_active: string
  mfa_enabled: boolean
  created_at: string
}

export default function UsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/users")
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users || [])
        }
      } catch {
        toast.error("Failed to load users")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await fetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", targetUserId: userId, reason: "Admin user management" }),
      })
      if (res.ok) {
        toast.success("Impersonation session started")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to start impersonation")
      }
    } catch {
      toast.error("Failed to start impersonation")
    }
  }

  const handleSuspendUser = async (userId: string) => {
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", userId }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "suspended" } : u)))
        toast.success("User suspended")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to suspend user")
      }
    } catch {
      toast.error("Failed to suspend user")
    }
  }

  const getRoleBadge = (role: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      owner: "default",
      admin: "secondary",
      member: "outline",
      viewer: "outline",
    }
    return <Badge variant={map[role] || "outline"}>{role}</Badge>
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.users.title")}</h1>
            <p className="text-muted-foreground">{t("admin.users.subtitle")}</p>
          </div>
        </div>
      </AnimatedGroup>

      <InView delay={0}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.users.searchPlaceholder")}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 font-medium">{t("admin.users.noUsers")}</p>
              <p className="text-sm">{search ? t("admin.users.trySearch") : t("admin.users.noUsersRegistered")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.users.user")}</TableHead>
                  <TableHead>{t("crm.communicationHub.channels.email")}</TableHead>
                  <TableHead>{t("admin.users.organization")}</TableHead>
                  <TableHead>{t("admin.users.role")}</TableHead>
                  <TableHead>{t("admin.users.status")}</TableHead>
                  <TableHead>{t("admin.users.lastActive")}</TableHead>
                  <TableHead>{t("admin.users.mfa")}</TableHead>
                  <TableHead className="w-32">{t("admin.users.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(user.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || t("admin.users.unnamed")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{user.email}</TableCell>
                    <TableCell className="text-xs">{user.organization_name || "—"}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.last_active ? new Date(user.last_active).toLocaleDateString() : t("admin.users.never")}
                    </TableCell>
                    <TableCell>
                      {user.mfa_enabled ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setProfileOpen(true)
                          }}
                          title={t("admin.users.viewProfile")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {user.role === "owner" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleImpersonate(user.id)}
                            title={t("admin.users.impersonate")}
                          >
                            <UserCheck className="h-4 w-4 text-amber-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleSuspendUser(user.id)}
                          title={t("admin.users.suspendUser")}
                        >
                          <PauseCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </InView>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.profileTitle")}</DialogTitle>
            <DialogDescription>{t("admin.users.profileDesc")}</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {(selectedUser.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{selectedUser.full_name || t("admin.users.unnamed")}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">{t("admin.users.role")}</p>
                  <p className="font-medium capitalize">{selectedUser.role}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">{t("admin.users.status")}</p>
                  <p className="font-medium capitalize">{selectedUser.status}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">{t("admin.users.organization")}</p>
                  <p className="font-medium">{selectedUser.organization_name || "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">{t("admin.users.mfa_enabled")}</p>
                  <p className="font-medium">{selectedUser.mfa_enabled ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
