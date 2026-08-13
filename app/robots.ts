import type { MetadataRoute } from "next"

// No robots.txt existed at all -- crawlers default to "allow everything",
// which for this app means Google would happily try to crawl authenticated
// dashboard routes (/crm, /settings, /platform, ...) and API endpoints that
// serve no purpose being indexed. Restrict crawling to the actual public
// marketing pages and point crawlers at the sitemap for those.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/security", "/privacy", "/terms", "/refund-policy", "/status"],
      disallow: [
        "/api/",
        "/auth/",
        "/admin/",
        "/admin-platform/",
        "/checkout/",
        "/onboarding/",
        "/secure-onboarding/",
        "/settings/",
        "/unauthorized/",
        "/login-check/",
        "/dash-test/",
        // App Router route groups like (dashboard) aren't part of the URL,
        // but every module they contain has its own top-level path -- block
        // those directly since they're only ever meaningful when signed in.
        "/dashboard",
        "/crm",
        "/compliance",
        "/resources",
        "/operations",
        "/performance",
        "/intelligence",
        "/analytics",
        "/configure",
        "/platform/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
