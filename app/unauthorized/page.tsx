import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to access this page. If you believe this is a mistake, contact your administrator.
        </p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Return to dashboard
        </Link>
      </div>
    </div>
  )
}
