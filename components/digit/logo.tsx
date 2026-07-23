import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  link?: boolean
}

const sizeMap = {
  sm: { badge: 22, sub: "text-[8px]" },
  md: { badge: 28, sub: "text-[10px]" },
  lg: { badge: 34, sub: "text-[11px]" },
}

const wordmarkAspect = 170 / 60

const FONT_STACK = "'Geist', 'Geist Fallback', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"

/**
 * The badge mark: a "D." monogram (bold D + a trailing cursor-dot) on a
 * teal gradient, in the same hue as the live UI accent (--primary, hue
 * ~195). Shared between the standalone icon (collapsed sidebar, favicon)
 * and the full wordmark lockup so both states use one consistent mark.
 */
function LogoMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="digit-mark-grad" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#3ce0e2" />
          <stop offset="100%" stopColor="#00a3a8" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#digit-mark-grad)" />
      <text
        x="42"
        y="68"
        textAnchor="middle"
        fontFamily={FONT_STACK}
        fontWeight="800"
        fontSize="58"
        fill="#052426"
      >
        D
      </text>
      <rect x="66" y="58" width="14" height="14" rx="3" fill="#052426" />
    </svg>
  )
}

function Wordmark({ size, className }: { size: number; className?: string }) {
  const height = size * 0.82
  const width = height * wordmarkAspect
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 170 60"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <text
        x="0"
        y="46"
        fontFamily={FONT_STACK}
        fontWeight="800"
        fontSize="46"
        fill="currentColor"
      >
        DigiT
      </text>
    </svg>
  )
}

export function Logo({ size = "md", showText = true, className, link }: LogoProps) {
  const s = sizeMap[size]

  const img = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={s.badge} />
      <div className="flex flex-col">
        <Wordmark size={s.badge} />
        {showText && (
          <p className={cn("text-muted-foreground/60 leading-tight tracking-wider", s.sub)}>ENTERPRISE INTELLIGENCE</p>
        )}
      </div>
    </div>
  )

  if (link) return <Link href="/">{img}</Link>
  return img
}

export function LogoIcon({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const s = sizeMap[size]
  return <LogoMark size={s.badge} className={className} />
}
