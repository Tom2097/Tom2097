"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Re-runs the current route's server components (fresh data, client state
 * kept). For server-rendered pages that want a "Refresh" button -- a plain
 * <Button> in a server component can't have an onClick, which is how the
 * CRM page's Refresh button ended up rendering with no handler at all.
 */
export function RefreshButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1 text-sm", className)}
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn("h-3 w-3", isPending && "animate-spin")} />
      {label}
    </Button>
  )
}
