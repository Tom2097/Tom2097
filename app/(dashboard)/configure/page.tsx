"use client"

import { useState, useEffect, useCallback } from "react"
import { SetupWizard } from "@/components/digit/setup-wizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Settings, Plus, LayoutDashboard, Shield, Boxes, Activity, Wifi, HeartPulse, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { RoutingRules } from "@/components/digit/routing-rules"
import { useI18n } from "@/components/providers/i18n-provider"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import { toast } from "sonner"

const verticalMeta: Record<string, { href: string | null; color: string; bg: string; icon: React.ReactNode }> = {
  operational: { href: "/operations", color: "text-indigo-500", bg: "bg-indigo-500/10", icon: <Wifi className="h-5 w-5" /> },
  performance: { href: "/performance", color: "text-amber-500", bg: "bg-amber-500/10", icon: <Activity className="h-5 w-5" /> },
  resources: { href: "/resources", color: "text-blue-500", bg: "bg-blue-500/10", icon: <Boxes className="h-5 w-5" /> },
  compliance: { href: "/compliance", color: "text-teal-500", bg: "bg-teal-500/10", icon: <Shield className="h-5 w-5" /> },
  healthcare: { href: "/healthcare", color: "text-rose-500", bg: "bg-rose-500/10", icon: <HeartPulse className="h-5 w-5" /> },
}
const defaultVerticalMeta = { href: null, color: "text-slate-500", bg: "bg-slate-500/10", icon: <Boxes className="h-5 w-5" /> }

export default function ConfigurePage() {
  const { t } = useI18n()
  const [showWizard, setShowWizard] = useState(false)
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; vertical: string }>>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/workspaces')
      const data = await res.json()
      if (res.ok) setWorkspaces(data.workspaces ?? [])
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoadingWorkspaces(false)
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchWorkspaces()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchWorkspaces])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/v1/workspaces/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete workspace')
      setWorkspaces((prev) => prev.filter((ws) => ws.id !== deleteTarget.id))
      toast.success(t('configure.page.deleteSuccess', { name: deleteTarget.name }))
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('configure.page.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (showWizard) {
    return (
      <SetupWizard
        onComplete={() => {
          setShowWizard(false)
          fetchWorkspaces()
        }}
        onCancel={() => setShowWizard(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('configure.page.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('configure.page.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />{t('configure.page.newWorkspace')}
          </Button>
        </div>
      </AnimatedGroup>

      <InView>
      <Tabs defaultValue="workspaces" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="workspaces">{t('configure.page.tabs.workspaces')}</TabsTrigger>
          <TabsTrigger value="routing">{t('configure.page.tabs.autoRouting')}</TabsTrigger>
        </TabsList>
        
        {/* Workspaces Tab */}
        <TabsContent value="workspaces">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspaces.map((ws) => {
              const meta = verticalMeta[ws.vertical?.toLowerCase()] ?? defaultVerticalMeta
              return (
                <Card key={ws.id} className="hover:border-primary/50 transition-colors group">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2.5 rounded-xl ${meta.bg} ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{ws.vertical}</Badge>
                    </div>
                    <CardTitle className="text-base mt-3">{ws.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {t('configure.page.workspaceDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex items-center gap-2">
                    {meta.href ? (
                      <Button size="sm" variant="outline" className="text-xs" asChild>
                        <Link href={meta.href}>
                          <LayoutDashboard className="h-3 w-3 mr-1" />{t('configure.page.open')}
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs" disabled title={t('configure.page.comingSoon')}>
                        <LayoutDashboard className="h-3 w-3 mr-1" />{t('configure.page.comingSoon')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowWizard(true)}>
                      <Settings className="h-3 w-3 mr-1" />{t('configure.page.reconfigure')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => setDeleteTarget({ id: ws.id, name: ws.name })}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />{t('configure.page.delete')}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}

            {loadingWorkspaces && (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your workspaces...
              </div>
            )}

            <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setShowWizard(true)}>
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium">{t('configure.page.createNewWorkspace')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('configure.page.createWorkspaceDesc')}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Routing Tab */}
        <TabsContent value="routing">
          <RoutingRules />
        </TabsContent>
      </Tabs>
      </InView>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('configure.page.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('configure.page.deleteConfirmDesc', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('configure.page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('configure.page.deleting') : t('configure.page.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
