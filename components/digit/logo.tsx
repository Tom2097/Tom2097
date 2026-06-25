import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  link?: boolean
}

const sizeMap = {
  sm: { height: 28, width: 64 },
  md: { height: 36, width: 82 },
  lg: { height: 44, width: 100 },
}

export function Logo({ size = "md", showText = true, className, link }: LogoProps) {
  const dims = sizeMap[size]

  const img = (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.jpeg"
        alt="DigiT"
        height={dims.height}
        width={dims.width}
        className="object-contain"
        priority
      />
      {showText && (
        <div>
          <h1 className="text-lg font-bold tracking-wider text-foreground">DigiT</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">Enterprise Intelligence</p>
        </div>
      )}
    </div>
  )

  if (link) {
    return <Link href="/">{img}</Link>
  }

  return img
}

export function LogoIcon({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = sizeMap[size]
  return (
    <Image
      src="/logo.jpeg"
      alt="DigiT"
      height={dims.height}
      width={dims.width}
      className={cn("object-contain", className)}
      priority
    />
  )
}
