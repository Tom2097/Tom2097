import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import { Badge } from "@/components/ui/badge"
import { getAllSlugs, getPostBySlug } from "@/lib/blog"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://digit-ai.org"

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: `${post.title} | DigiT Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      url: `${siteUrl}/blog/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: "DigiT" },
    publisher: { "@type": "Organization", name: "DigiT", logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` } },
    mainEntityOfPage: `${siteUrl}/blog/${slug}`,
  }

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Logo size="sm" link />
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-3xl px-6 py-12 md:py-16">
        <AnimatedGroup className="mb-10">
          <div className="flex flex-wrap items-center gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground">{post.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatDate(post.date)} · {post.readingTime}
          </p>
        </AnimatedGroup>

        <InView>
          <div
            className="max-w-none leading-relaxed text-muted-foreground
              [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground
              [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground
              [&_p]:mt-4 [&_p]:leading-relaxed
              [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6
              [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6
              [&_li]:leading-relaxed
              [&_strong]:font-semibold [&_strong]:text-foreground
              [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4
              [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-foreground"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </InView>

        <InView className="mt-16 border-t border-border/50 pt-8">
          <p className="text-sm text-muted-foreground">
            Want to see this in practice?{" "}
            <Link href="/checkout" className="text-primary hover:underline">
              Start a free trial
            </Link>
            .
          </p>
        </InView>
      </main>
    </div>
  )
}
