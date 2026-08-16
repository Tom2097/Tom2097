import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import readingTime from "reading-time"
import { marked } from "marked"

const BLOG_DIR = path.join(process.cwd(), "content/blog")

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  tags: string[]
  readingTime: string
}

export interface BlogPost extends BlogPostMeta {
  html: string
}

function readSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
}

function readMeta(slug: string): BlogPostMeta {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.md`), "utf8")
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    date: data.date as string,
    tags: (data.tags as string[]) || [],
    readingTime: readingTime(content).text,
  }
}

export function getAllPosts(): BlogPostMeta[] {
  return readSlugs()
    .map(readMeta)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getAllSlugs(): string[] {
  return readSlugs()
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    date: data.date as string,
    tags: (data.tags as string[]) || [],
    readingTime: readingTime(content).text,
    html: marked.parse(content) as string,
  }
}
