import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAllPosts } from "@/lib/blog"

export const metadata: Metadata = {
  title: "Blog | DigiT",
  description: "Notes on unified business operations, AI forecasting, and running a company on one operating layer instead of a dozen disconnected tools.",
  alternates: { canonical: "/blog" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />

      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Logo size="sm" link />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-3xl px-6 py-12 md:py-16">
        <AnimatedGroup className="mb-12">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground">Blog</h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            Notes on unified operations, AI that actually reasons across your data, and running a business
            on one platform instead of a dozen disconnected tools.
          </p>
        </AnimatedGroup>

        <div className="space-y-4">
          {posts.map((post, i) => (
            <InView key={post.slug} delay={i * 0.06}>
              <Link href={`/blog/${post.slug}`}>
                <Card className="group p-6 transition-all duration-300 hover:border-primary/30 md:p-8">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(post.date)} · {post.readingTime}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{post.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Read post <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Card>
              </Link>
            </InView>
          ))}
          {posts.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No posts yet — check back soon.</p>
          )}
        </div>
      </main>
    </div>
  )
}
