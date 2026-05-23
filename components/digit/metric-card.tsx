'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'stable'
  subtitle?: string
  className?: string
  variant?: 'default' | 'highlight' | 'glass'
}

export function MetricCard({ 
  label, 
  value, 
  change, 
  trend = 'stable',
  subtitle,
  className,
  variant = 'default'
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  
  return (
    <div 
      className={cn(
        "rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02]",
        variant === 'default' && "border-border/50 bg-card",
        variant === 'highlight' && "border-primary/30 bg-primary/5 digit-glow-sm",
        variant === 'glass' && "digit-glass",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            trend === 'up' && "bg-emerald-500/10 text-emerald-500",
            trend === 'down' && "bg-red-500/10 text-red-500",
            trend === 'stable' && "bg-muted text-muted-foreground"
          )}>
            <TrendIcon className="h-3 w-3" />
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      
      <p className="mt-3 text-4xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

interface MetricGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function MetricGrid({ children, columns = 4, className }: MetricGridProps) {
  return (
    <div className={cn(
      "grid gap-4",
      columns === 2 && "grid-cols-1 sm:grid-cols-2",
      columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  )
}
