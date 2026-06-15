import { createServiceClient } from "@/lib/supabase/service"
import { indexDocument, removeDocument } from "@/lib/search/index-helper"
import {
  ARTICLE_STATUSES,
  type Article,
  type ArticleFeedback,
  type ArticleFeedbackInput,
  type ArticleInput,
  type ArticleStatus,
  type ArticleUpdateInput,
  type Category,
  type CategoryInput,
  type CategoryUpdateInput,
  type ListArticlesOptions,
  type ListCategoriesOptions,
} from "./types"

/**
 * Module #18: Knowledge Base engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Published articles are mirrored
 * into the Module #4 universal search index (resourceType "kb_article").
 */

const SEARCH_RESOURCE = "kb_article"
const MAX_BODY = 200_000

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return Array.from(
    new Set(
      tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase())
        .slice(0, 50),
    ),
  )
}

/** Slugify a string into a url-safe token. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

/**
 * Resolve a unique slug within the org for a given table, appending -2, -3, …
 * on collision. Excludes `excludeId` so updates keep their own slug.
 */
async function uniqueSlug(
  table: "kb_categories" | "kb_articles",
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const db = createServiceClient()
  const root = base || "untitled"
  let candidate = root
  let n = 1
  // bounded loop; practically resolves in 1-2 iterations
  while (n < 1000) {
    let q = db
      .from(table)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", candidate)
      .limit(1)
    if (excludeId) q = q.neq("id", excludeId)
    const { data, error } = await q
    if (error) {
      console.log("[v0] uniqueSlug failed:", error.message)
      throw new Error("failed to resolve slug")
    }
    if (!data || data.length === 0) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
  return `${root}-${Date.now()}`
}

// ── Categories ──────────────────────────────────────────────────────────────

export function validateCategory(input: unknown): string | null {
  if (!input || typeof input !== "object") return "category must be an object"
  const c = input as CategoryInput
  if (!c.name || typeof c.name !== "string" || !c.name.trim()) return "name is required"
  if (c.name.length > 200) return "name too long (max 200)"
  return null
}

export async function createCategory(
  organizationId: string,
  createdBy: string,
  input: CategoryInput,
): Promise<Category> {
  const db = createServiceClient()
  const slug = await uniqueSlug("kb_categories", organizationId, input.slug?.trim() || slugify(input.name))

  // Validate parent belongs to same org (prevents cross-tenant nesting).
  let parentId: string | null = null
  if (input.parent_id) {
    const parent = await getCategory(organizationId, input.parent_id)
    if (!parent) throw new Error("parent category not found")
    parentId = parent.id
  }

  const { data, error } = await db
    .from("kb_categories")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      parent_id: parentId,
      name: input.name.trim(),
      slug,
      description: clampStr(input.description, 2000),
      position: typeof input.position === "number" ? input.position : 0,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createCategory failed:", error.message)
    throw new Error("failed to create category")
  }
  return data as Category
}

export async function listCategories(
  organizationId: string,
  opts: ListCategoriesOptions,
): Promise<{ categories: Category[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("kb_categories")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.parentId === null) query = query.is("parent_id", null)
  else if (typeof opts.parentId === "string") query = query.eq("parent_id", opts.parentId)

  query = query
    .order("position", { ascending: true })
    .order("name", { ascending: true })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listCategories failed:", error.message)
    throw new Error("failed to list categories")
  }
  return { categories: (data ?? []) as Category[], total: count ?? 0 }
}

export async function getCategory(organizationId: string, id: string): Promise<Category | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("kb_categories")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getCategory failed:", error.message)
    throw new Error("failed to fetch category")
  }
  return (data as Category) ?? null
}

export async function updateCategory(
  organizationId: string,
  id: string,
  input: CategoryUpdateInput,
): Promise<Category | null> {
  const db = createServiceClient()
  const existing = await getCategory(organizationId, id)
  if (!existing) return null

  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim().slice(0, 200)
  if ("description" in input) patch.description = clampStr(input.description, 2000)
  if (typeof input.position === "number") patch.position = input.position
  if (typeof input.slug === "string" && input.slug.trim()) {
    patch.slug = await uniqueSlug("kb_categories", organizationId, slugify(input.slug), id)
  }
  if ("parent_id" in input) {
    if (input.parent_id && input.parent_id !== id) {
      const parent = await getCategory(organizationId, input.parent_id)
      if (!parent) throw new Error("parent category not found")
      patch.parent_id = parent.id
    } else {
      patch.parent_id = null
    }
  }
  if (Object.keys(patch).length === 0) return existing

  const { data, error } = await db
    .from("kb_categories")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] updateCategory failed:", error.message)
    throw new Error("failed to update category")
  }
  return data as Category
}

export async function deleteCategory(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const existing = await getCategory(organizationId, id)
  if (!existing) return false
  const { error } = await db.from("kb_categories").delete().eq("organization_id", organizationId).eq("id", id)
  if (error) {
    console.log("[v0] deleteCategory failed:", error.message)
    throw new Error("failed to delete category")
  }
  return true
}

// ── Articles ──────────────────────────────────────────────────────────────────

export function validateArticle(input: unknown): string | null {
  if (!input || typeof input !== "object") return "article must be an object"
  const a = input as ArticleInput
  if (!a.title || typeof a.title !== "string" || !a.title.trim()) return "title is required"
  if (a.title.length > 300) return "title too long (max 300)"
  if (a.status !== undefined && !ARTICLE_STATUSES.includes(a.status)) return "invalid status"
  return null
}

/** Mirror a published article into universal search; remove otherwise. */
async function syncArticleSearch(article: Article): Promise<void> {
  try {
    if (article.status === "published") {
      await indexDocument({
        organizationId: article.organization_id,
        resourceType: SEARCH_RESOURCE,
        resourceId: article.id,
        title: article.title,
        body: article.excerpt || article.body.slice(0, 4000),
        url: `/kb/${article.slug}`,
        metadata: { categoryId: article.category_id, tags: article.tags, status: article.status },
      })
    } else {
      await removeDocument(article.organization_id, SEARCH_RESOURCE, article.id)
    }
  } catch (e) {
    // Search is best-effort; never block the primary write.
    console.log("[v0] syncArticleSearch failed:", (e as Error).message)
  }
}

export async function createArticle(
  organizationId: string,
  createdBy: string,
  input: ArticleInput,
): Promise<Article> {
  const db = createServiceClient()
  const status = pick(ARTICLE_STATUSES, input.status, "draft")
  const slug = await uniqueSlug("kb_articles", organizationId, input.slug?.trim() || slugify(input.title))

  let categoryId: string | null = null
  if (input.category_id) {
    const cat = await getCategory(organizationId, input.category_id)
    if (!cat) throw new Error("category not found")
    categoryId = cat.id
  }

  const { data, error } = await db
    .from("kb_articles")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      author_id: input.author_id ?? createdBy,
      category_id: categoryId,
      title: input.title.trim().slice(0, 300),
      slug,
      excerpt: clampStr(input.excerpt, 1000),
      body: typeof input.body === "string" ? input.body.slice(0, MAX_BODY) : "",
      status,
      tags: sanitizeTags(input.tags),
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createArticle failed:", error.message)
    throw new Error("failed to create article")
  }
  const article = data as Article
  await syncArticleSearch(article)
  return article
}

export async function listArticles(
  organizationId: string,
  opts: ListArticlesOptions,
): Promise<{ articles: Article[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("kb_articles")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId)
  if (opts.tag) query = query.contains("tags", [opts.tag.toLowerCase()])
  if (opts.search?.trim()) query = query.ilike("title", `%${opts.search.trim()}%`)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listArticles failed:", error.message)
    throw new Error("failed to list articles")
  }
  return { articles: (data ?? []) as Article[], total: count ?? 0 }
}

export async function getArticle(organizationId: string, id: string): Promise<Article | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getArticle failed:", error.message)
    throw new Error("failed to fetch article")
  }
  return (data as Article) ?? null
}

export async function getArticleBySlug(organizationId: string, slug: string): Promise<Article | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("kb_articles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("slug", slug)
    .maybeSingle()
  if (error) {
    console.log("[v0] getArticleBySlug failed:", error.message)
    throw new Error("failed to fetch article")
  }
  return (data as Article) ?? null
}

/**
 * Update an article. Returns the updated row plus a `statusChange` describing a
 * publish/unpublish transition so the caller can emit the right audit event.
 */
export async function updateArticle(
  organizationId: string,
  id: string,
  input: ArticleUpdateInput,
): Promise<{ article: Article; statusChange: "published" | "unpublished" | null } | null> {
  const db = createServiceClient()
  const existing = await getArticle(organizationId, id)
  if (!existing) return null

  const patch: Record<string, unknown> = {}
  if (typeof input.title === "string" && input.title.trim()) patch.title = input.title.trim().slice(0, 300)
  if ("excerpt" in input) patch.excerpt = clampStr(input.excerpt, 1000)
  if (typeof input.body === "string") patch.body = input.body.slice(0, MAX_BODY)
  if (Array.isArray(input.tags)) patch.tags = sanitizeTags(input.tags)
  if (typeof input.slug === "string" && input.slug.trim()) {
    patch.slug = await uniqueSlug("kb_articles", organizationId, slugify(input.slug), id)
  }
  if ("category_id" in input) {
    if (input.category_id) {
      const cat = await getCategory(organizationId, input.category_id)
      if (!cat) throw new Error("category not found")
      patch.category_id = cat.id
    } else {
      patch.category_id = null
    }
  }

  let statusChange: "published" | "unpublished" | null = null
  if (input.status !== undefined && ARTICLE_STATUSES.includes(input.status)) {
    const next = input.status as ArticleStatus
    patch.status = next
    if (next === "published" && existing.status !== "published") {
      statusChange = "published"
      patch.published_at = existing.published_at ?? new Date().toISOString()
    } else if (next !== "published" && existing.status === "published") {
      statusChange = "unpublished"
    }
  }

  if (Object.keys(patch).length === 0) return { article: existing, statusChange: null }

  const { data, error } = await db
    .from("kb_articles")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] updateArticle failed:", error.message)
    throw new Error("failed to update article")
  }
  const article = data as Article
  await syncArticleSearch(article)
  return { article, statusChange }
}

export async function deleteArticle(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const existing = await getArticle(organizationId, id)
  if (!existing) return false
  const { error } = await db.from("kb_articles").delete().eq("organization_id", organizationId).eq("id", id)
  if (error) {
    console.log("[v0] deleteArticle failed:", error.message)
    throw new Error("failed to delete article")
  }
  await removeDocument(organizationId, SEARCH_RESOURCE, id).catch((e) =>
    console.log("[v0] deleteArticle search cleanup failed:", (e as Error).message),
  )
  return true
}

/** Atomically increment the view counter via the SECURITY DEFINER RPC. */
export async function recordArticleView(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const existing = await getArticle(organizationId, id)
  if (!existing) return false
  const { error } = await db.rpc("increment_kb_article_views", {
    p_organization_id: organizationId,
    p_article_id: id,
  })
  if (error) {
    console.log("[v0] recordArticleView failed:", error.message)
    throw new Error("failed to record view")
  }
  return true
}

// ── Feedback ────────────────────────────────────────────────────────────────

/**
 * Upsert a user's helpful/not-helpful vote (one per user per article) and keep
 * the denormalized counts on the article in sync.
 */
export async function submitArticleFeedback(
  organizationId: string,
  userId: string,
  articleId: string,
  input: ArticleFeedbackInput,
): Promise<ArticleFeedback | null> {
  if (typeof input?.is_helpful !== "boolean") throw new Error("is_helpful (boolean) is required")
  const db = createServiceClient()

  const article = await getArticle(organizationId, articleId)
  if (!article) return null

  // Capture prior vote to compute count deltas.
  const { data: prior } = await db
    .from("kb_article_feedback")
    .select("is_helpful")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .maybeSingle()

  const { data, error } = await db
    .from("kb_article_feedback")
    .upsert(
      {
        organization_id: organizationId,
        article_id: articleId,
        user_id: userId,
        is_helpful: input.is_helpful,
        comment: clampStr(input.comment, 2000),
      },
      { onConflict: "article_id,user_id" },
    )
    .select("*")
    .single()
  if (error) {
    console.log("[v0] submitArticleFeedback failed:", error.message)
    throw new Error("failed to submit feedback")
  }

  // Recompute deltas: remove prior contribution, add new.
  let helpful = article.helpful_count
  let notHelpful = article.not_helpful_count
  if (prior) {
    if (prior.is_helpful) helpful -= 1
    else notHelpful -= 1
  }
  if (input.is_helpful) helpful += 1
  else notHelpful += 1

  const { error: upErr } = await db
    .from("kb_articles")
    .update({ helpful_count: Math.max(0, helpful), not_helpful_count: Math.max(0, notHelpful) })
    .eq("organization_id", organizationId)
    .eq("id", articleId)
  if (upErr) console.log("[v0] feedback count update failed:", upErr.message)

  return data as ArticleFeedback
}
