import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  link?: boolean
}

const sizeMap = {
  sm: { icon: 22, sub: "text-[8px]" },
  md: { icon: 28, sub: "text-[10px]" },
  lg: { icon: 34, sub: "text-[11px]" },
}

const aspect = 250 / 100

function LogoSvg({ size: iconSize, className }: { size: number; className?: string }) {
  return (
    <svg width={iconSize} height={iconSize / aspect} viewBox="0 0 250 100" xmlns="http://www.w3.org/2000/svg" className={cn("shrink-0", className)}>
      <g transform="translate(20, 75)">
        <text fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="800" fontSize="56" fill="currentColor">
          <tspan x="0">D</tspan>
          <tspan x="42">i</tspan>
          <tspan x="58">g</tspan>
        </text>
        <rect x="98" y="-40" width="11" height="41" fill="currentColor" />
        <text fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="800" fontSize="56" fill="currentColor">
          <tspan x="116">T</tspan>
        </text>
        <circle cx="86.5" cy="-56" r="6" fill="#78d6c7" />
        <circle cx="103.5" cy="-56" r="6" fill="#00c875" />
        <circle cx="120.5" cy="-56" r="6" fill="#1a56db" />
      </g>
    </svg>
  )
}

function LogoSvgIcon({ size: iconSize, className }: { size: number; className?: string }) {
  const dotR = 6
  const cx1 = 86.5, cx2 = 103.5, cx3 = 120.5, cy = -56
  const minX = cx1 - dotR
  const maxX = cx3 + dotR
  const minY = cy - dotR
  const maxY = cy + dotR
  const iconW = maxX - minX
  const iconH = maxY - minY
  const scale = iconSize / Math.max(iconW, iconH)
  const offsetX = (iconSize - iconW * scale) / 2 - minX * scale
  const offsetY = (iconSize - iconH * scale) / 2 - minY * scale

  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 250 100" xmlns="http://www.w3.org/2000/svg" className={cn("shrink-0", className)}>
      <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
        <circle cx={cx1} cy={cy} r={dotR} fill="#78d6c7" />
        <circle cx={cx2} cy={cy} r={dotR} fill="#00c875" />
        <circle cx={cx3} cy={cy} r={dotR} fill="#1a56db" />
      </g>
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
  return <LogoSvgIcon size={s.icon} className={className} />
}
