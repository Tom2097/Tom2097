"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card } from '@/components/ui/card'
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { type DetectedAnomaly } from '@/lib/analytics/anomaly-detection'
import { type ForecastPoint } from '@/lib/analytics/forecasting'

interface RealTimeChartProps {
  data: Array<{
    name: string
    value: number
    timestamp?: string
    [key: string]: unknown
  }>
  dataKey: string
  type: 'line' | 'area' | 'bar'
  height?: number
  anomalies?: DetectedAnomaly[]
  forecast?: ForecastPoint[]
  className?: string
}

export function RealTimeChart({
  data,
  dataKey,
  type,
  height = 300,
  anomalies = [],
  forecast = [],
  className,
}: RealTimeChartProps) {
  const [chartData, setChartData] = useState(data)
  const [liveAnomalies, setLiveAnomalies] = useState<DetectedAnomaly[]>(anomalies)
  const [liveForecast, setLiveForecast] = useState<ForecastPoint[]>(forecast)

  useEffect(() => {
    // Update chart data when props change
    const updateData = () => {
      setChartData(data)
      setLiveAnomalies(anomalies)
      setLiveForecast(forecast)
    }
    
    updateData()
  }, [data, anomalies, forecast])

  const getAnomalyForPoint = (name: string) => {
    return liveAnomalies.find(a => a.bucket === name || a.timestamp === name)
  }

  const getForecastForPoint = (timestamp: string) => {
    return liveForecast.find(f => f.timestamp === timestamp)
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }

    const anomalyAnnotations = liveAnomalies.map((anomaly, index) => {
      const x = chartData.findIndex(d => d.name === anomaly.bucket || d.timestamp === anomaly.timestamp)
      if (x === -1) return null
      return (
        <g key={`anomaly-${index}`}>
          <circle cx={x} cy={chartData[x]?.value} r={8} fill="#ef4444" fillOpacity={0.6} />
          <text x={x} y={chartData[x]?.value - 10} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">
            !
          </text>
        </g>
      )
    }).filter(Boolean)

    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="hsl(var(--chart-1))"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
            {liveForecast.length > 0 && (
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--chart-2))"
                strokeDasharray="5 5"
                fillOpacity={0}
                dot={false}
              />
            )}
          </AreaChart>
        )
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={(props) => {
                const anomaly = getAnomalyForPoint(props.payload.name)
                if (anomaly) {
                  return (
                    <circle cx={props.cx} cy={props.cy} r={6} fill="#ef4444" />
                  )
                }
                return <circle cx={props.cx} cy={props.cy} r={3} fill="hsl(var(--chart-1))" />
              }}
            />
          </LineChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey={dataKey}
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )
      default:
        return null
    }
  }

  const chartConfig = useMemo(() => ({
    value: { label: dataKey, color: "hsl(var(--chart-1))" },
  }), [dataKey])

  return (
    <Card className={className}>
      <ChartContainer config={chartConfig} className="aspect-none" style={{ minHeight: height }}>
        {renderChart() || <div />}
      </ChartContainer>
      {liveAnomalies.length > 0 && (
        <div className="p-4 border-t border-border/50">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Detected Anomalies
          </h4>
          <div className="space-y-2 text-xs">
             {liveAnomalies.slice(0, 3).map((anomaly, index) => {
               const trend = anomaly.deviation > 0 ? 'up' : 'down'
               return (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div>
                      <div className="font-medium">{anomaly.type.replace('_', ' ')}</div>
                      <div className="text-muted-foreground">
                        {new Date(anomaly.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                      {trend === 'up' ? '+' : ''}{Math.round(anomaly.deviationPercentage)}%
                    </span>
                    {trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-red-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </div>
               )
             })}
          </div>
        </div>
      )}
      {liveForecast.length > 0 && (
        <div className="p-4 border-t border-border/50">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Forecast
          </h4>
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="font-medium">Next 6 months</div>
              <div className="text-muted-foreground">
                {Math.round(((liveForecast[liveForecast.length - 1].forecast - chartData[0]?.value) / chartData[0]?.value) * 100)}% growth projected
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-blue-500">
                {Math.round(liveForecast[liveForecast.length - 1].forecast)}
              </span>
              <TrendingUp className="h-3 w-3 text-blue-500" />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}