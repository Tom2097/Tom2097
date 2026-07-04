import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ErrorBoundary } from '@/components/ui/error-boundary'
// import { QueryProvider } from '@/components/providers/query-provider'

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
})

export const metadata: Metadata = {
  title: 'DigiT | Enterprise Intelligence Platform',
  description: 'AI-powered operational intelligence platform for enterprises. Configurable analytics, CRM, and operational workspaces for any team or business function.',
  generator: 'v0.app',
  keywords: ['enterprise', 'AI', 'analytics', 'business intelligence', 'operational intelligence'],
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
       <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
         <ErrorBoundary>
     
             {children}
   
         </ErrorBoundary>
         {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
