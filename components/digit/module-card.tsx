'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { 
  BarChart3, 
  Users, 
  Heart, 
  Building2, 
  Wheat, 
  Pill,
  type LucideIcon
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  Users,
  Heart,
  Building2,
  Wheat,
  Pill
}

interface ModuleCardProps {
  id: string
  title: string
  icon: string
  description: string
  metrics: string[]
  href: string
  className?: string
}

export function ModuleCard({ 
  title, 
  icon, 
  description, 
  metrics, 
  href,
  className 
}: ModuleCardProps) {
  const Icon = iconMap[icon] || BarChart3

  return (
    <Link 
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:scale-[1.02] hover:digit-glow-sm",
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-7 w-7" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-foreground">{title}</h3>

      {/* Description */}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {/* Metrics */}
      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.slice(0, 3).map((metric) => (
          <span 
            key={metric}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
          >
            {metric}
          </span>
        ))}
      </div>

      {/* Action */}
      <div className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary transition-colors">
        <span>Open Module</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

interface ModuleGridProps {
  children: React.ReactNode
  className?: string
}

export function ModuleGrid({ children, className }: ModuleGridProps) {
  return (
    <div className={cn(
      "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {children}
    </div>
  )
}
