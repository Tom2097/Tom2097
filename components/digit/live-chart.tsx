'use client'

import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart, 
  Line, 
  LineChart,
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import { cn } from '@/lib/utils'

interface ChartContainerProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export function ChartContainer({ children, title, subtitle, className }: ChartContainerProps) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-6", className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

interface LiveChartProps {
  data: Array<Record<string, string | number>>
  type?: 'area' | 'line' | 'bar'
  dataKey: string
  xAxisKey?: string
  height?: number
  color?: string
  showGrid?: boolean
  showLegend?: boolean
  className?: string
  // When true (default) values render as currency. Set false for plain counts.
  currency?: boolean
}

// Bright cyan color that's visible on dark backgrounds
const CHART_CYAN = '#22d3ee'
const CHART_CYAN_DIM = '#06b6d4'

export function LiveChart({ 
  data, 
  type = 'area',
  dataKey,
  xAxisKey = 'name',
  height = 300,
  color = CHART_CYAN,
  showGrid = true,
  showLegend = false,
  className,
  currency = true
}: LiveChartProps) {
  const ChartComponent = type === 'area' ? AreaChart : type === 'line' ? LineChart : BarChart

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data}>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.1)" 
              vertical={false}
            />
          )}
          <XAxis 
            dataKey={xAxisKey} 
            stroke="rgba(255, 255, 255, 0.5)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="rgba(255, 255, 255, 0.5)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
              return value
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(22, 22, 35, 0.95)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12px'
            }}
            formatter={(value: number) => {
              const prefix = currency ? '$' : ''
              if (value >= 1000000) return [`${prefix}${(value / 1000000).toFixed(2)}M`, dataKey]
              if (value >= 1000) return [`${prefix}${(value / 1000).toFixed(0)}K`, dataKey]
              return [value, dataKey]
            }}
          />
          {showLegend && <Legend />}
          
          {type === 'area' && (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          )}
          
          {type === 'line' && (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          )}
          
          {type === 'bar' && (
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

interface MultiLineChartProps {
  data: Array<Record<string, string | number>>
  lines: Array<{ dataKey: string; color: string; name?: string }>
  xAxisKey?: string
  height?: number
  showGrid?: boolean
  className?: string
}

export function MultiLineChart({
  data,
  lines,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  className
}: MultiLineChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.1)" 
              vertical={false}
            />
          )}
          <XAxis 
            dataKey={xAxisKey} 
            stroke="rgba(255, 255, 255, 0.5)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="rgba(255, 255, 255, 0.5)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(22, 22, 35, 0.95)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12px'
            }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              name={line.name || line.dataKey}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
