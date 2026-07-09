"use client"

import { Button } from '@/components/ui/button'
import { MicrophoneButton } from '@/components/ui/microphone-button'
import { FeedbackWidget } from '@/components/feedback-widget'
import { LanguageSwitcher } from '@/components/language-switcher'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logger } from "@/lib/logging-client"

interface NavbarProps {
  userId?: string
}

export function Navbar({ userId }: NavbarProps) {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-6"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v6h-2zm0 8h2v2h-2z" />
              <path d="M12.5 7.5c0-1.38-1.12-2.5-2.5-2.5S7.5 6.12 7.5 7.5s1.12 2.5 2.5 2.5S12.5 8.88 12.5 7.5z" fill="white" />
            </svg>
            <span className="font-bold">DigiT</span>
          </Link>
          <div className="hidden gap-4 md:flex">
            <Link href="/dashboard" className={pathname === '/dashboard' ? 'font-medium' : 'text-muted-foreground'}>
              Dashboard
            </Link>
            <Link href="/analytics" className={pathname === '/analytics' ? 'font-medium' : 'text-muted-foreground'}>
              Analytics
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <MicrophoneButton onTranscript={(transcript) => logger.logDebug('Transcript:', { transcript })} />
          <FeedbackWidget userId={userId} />
          <LanguageSwitcher />
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}