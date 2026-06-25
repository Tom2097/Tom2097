import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  link?: boolean
}

const sizeMap = {
  sm: { icon: 22, text: "text-sm", sub: "text-[8px]" },
  md: { icon: 28, text: "text-lg", sub: "text-[10px]" },
  lg: { icon: 34, text: "text-xl", sub: "text-[11px]" },
}

function LogoSvg({ size: iconSize, className }: { size: number; className?: string }) {
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`lg-${iconSize}`} x1="0" y1="0" x2="44" y2="44">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="43" height="43" rx="10" fill={`url(#lg-${iconSize})`}/>
      <rect x="0.5" y="0.5" width="43" height="43" rx="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      <path d="M8 34V16h8c6.5 0 11 3 11 9s-4.5 9-11 9H8z" fill="white" opacity="0.15"/>
      <path d="M12 18h6c5 0 8 2.5 8 7s-3 7-8 7h-6V18z" fill="white"/>
    </svg>
  )
}

export function Logo({ size = "md", showText = true, className, link }: LogoProps) {
  const s = sizeMap[size]

  const img = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoSvg size={s.icon} />
      {showText && (
        <div>
          <h1 className={cn("font-extrabold tracking-tight text-foreground", s.text)}>DigiT</h1>
          <p className={cn("text-muted-foreground/60 leading-tight tracking-wider", s.sub)}>ENTERPRISE INTELLIGENCE</p>
        </div>
      )}
    </div>
  )

  if (link) return <Link href="/">{img}</Link>
  return img
}

export function LogoIcon({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const s = sizeMap[size]
  return <LogoSvg size={s.icon} className={className} />
}
