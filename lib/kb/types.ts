/**
 * Module #18: Knowledge Base — types.
 *
 * Hierarchical categories + articles (draft/published/archived) + per-user
 * helpful feedback. Published articles are mirrored into Module #4 universal
 * search. All records are tenant-scoped by organization_id.
 */

export const ARTICLE_STATUSES = ["draft", "published", "archived"] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

// ── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  id: string
  organization_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CategoryInput {
  name: string
  slug?: string
  description?: string | null
  parent_id?: string | null
  position?: number
}

export type CategoryUpdateInput = Partial<CategoryInput>

export interface ListCategoriesOptions {
  parentId?: string | null
  limit?: number
  offset?: number
}

// ── Articles ──────────────────────────────────────────────────────────────────

export interface Article {
  id: string
  organization_id: string
  category_id: string | null
  title: string
  slug: string
  excerpt: string | null
  body: string
  status: ArticleStatus
  tags: string[]
  view_count: number
  helpful_count: number
  not_helpful_count: number
  published_at: string | null
  author_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ArticleInput {
  title: string
  slug?: string
  excerpt?: string | null
  body?: string
  status?: ArticleStatus
  category_id?: string | null
  tags?: string[]
  author_id?: string | null
}

export type ArticleUpdateInput = Partial<ArticleInput>

export interface ListArticlesOptions {
  status?: ArticleStatus
  categoryId?: string
  search?: string
  tag?: string
  limit?: number
  offset?: number
}

// ── Feedback ────────────────────────────────────────────────────────────────

export interface ArticleFeedback {
  id: string
  organization_id: string
  article_id: string
  user_id: string
  is_helpful: boolean
  comment: string | null
  created_at: string
  updated_at: string
}

export interface ArticleFeedbackInput {
  is_helpful: boolean
  comment?: string | null
}
