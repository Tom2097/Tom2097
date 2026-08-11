import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { I18nProvider } from '@/components/providers/i18n-provider'
import { LanguageDetectionBanner } from '@/components/language-detection-banner'
import { VisitorTracker } from '@/components/analytics/visitor-tracker'
import { ThemeProvider } from '@/components/theme-provider'
import { cookies } from 'next/headers'
import { resolveLocale } from '@/lib/i18n/config'
// import { QueryProvider } from '@/components/providers/query-provider'

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  const title = t("root.metadata.title")
  const description = t("root.metadata.description")
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    generator: 'v0.app',
    keywords: t("root.metadata.keywords").split(',').map((k) => k.trim()),
    icons: {
      icon: '/icon.svg',
      apple: '/icon.svg',
    },
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: 'DigiT',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const initialLocale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value)

  return (
    <html lang={initialLocale} className="bg-background" suppressHydrationWarning>
       <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
         <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
           <I18nProvider initialLocale={initialLocale}>
             <ErrorBoundary>
               <LanguageDetectionBanner />
               <VisitorTracker />
               {children}
             </ErrorBoundary>
           </I18nProvider>
         </ThemeProvider>
      </body>
    </html>
  )
}
