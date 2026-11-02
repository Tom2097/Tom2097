import { Fragment, type ReactNode } from "react"

/**
 * Minimal, XSS-safe Markdown renderer for AI chat replies. The assistant
 * answers in Markdown, which was shown raw (literal **, ###, ---) inside a
 * whitespace-pre-wrap div. This builds React elements directly -- no HTML
 * string, no dangerouslySetInnerHTML -- so model output (which can echo
 * user-supplied data) is always escaped by React.
 *
 * Supports: # headings, **bold**, *italic* / _italic_, `code`, fenced code
 * blocks, - / * / 1. lists, --- rules, and paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${i++}`
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>)
    } else if (tok.startsWith("`")) {
      out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>)
    } else {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let code: string[] | null = null

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`
      blocks.push(
        <p key={k}>
          {para.map((l, idx) => (
            <Fragment key={idx}>
              {idx > 0 && <br />}
              {renderInline(l, `${k}-${idx}`)}
            </Fragment>
          ))}
        </p>,
      )
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`
      const items = list.items.map((it, idx) => <li key={idx}>{renderInline(it, `${k}-${idx}`)}</li>)
      blocks.push(
        list.ordered
          ? <ol key={k} className="list-decimal space-y-1 pl-5">{items}</ol>
          : <ul key={k} className="list-disc space-y-1 pl-5">{items}</ul>,
      )
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (code) {
      if (line.trim().startsWith("```")) {
        blocks.push(
          <pre key={`c${blocks.length}`} className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
            {code.join("\n")}
          </pre>,
        )
        code = null
      } else {
        code.push(raw)
      }
      continue
    }
    if (line.trim().startsWith("```")) {
      flushPara(); flushList()
      code = []
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)

    if (!line.trim()) {
      flushPara(); flushList()
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara(); flushList()
      blocks.push(<hr key={`h${blocks.length}`} className="my-2 border-border" />)
    } else if (heading) {
      flushPara(); flushList()
      const k = `t${blocks.length}`
      blocks.push(<p key={k} className="font-semibold">{renderInline(heading[2], k)}</p>)
    } else if (bullet || ordered) {
      flushPara()
      const isOrdered = !bullet
      if (!list || list.ordered !== isOrdered) {
        flushList()
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push((bullet ?? ordered)![1])
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  if (code) blocks.push(<pre key={`c${blocks.length}`} className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{(code as string[]).join("\n")}</pre>)
  flushPara(); flushList()

  return <div className={className ?? "space-y-2 break-words"}>{blocks}</div>
}
