import type { MetadataRoute } from "next"
import { getAllPosts } from "@/lib/blog"

// No sitemap existed -- Google can still discover pages by crawling links,
// but a sitemap makes discovery immediate and lets Search Console track
// coverage per URL. Limited to the actual public marketing pages (matches
// the allow-list in robots.ts); everything else needs a session to be
// meaningful and shouldn't be indexed at all.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const now = new Date()

  const posts = getAllPosts()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]
}
