"use client"

import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ComplianceMetric } from "@/lib/compliance/scoring"

interface ComplianceScoreChartProps {
  data: ComplianceMetric[]
}

export function ComplianceScoreChart({ data }: ComplianceScoreChartProps) {
  const chartConfig = {
    score: {
      label: "Score",
      color: "hsl(var(--chart-1))",
    },
    gaps: {
      label: "Gaps",
      color: "hsl(var(--chart-2))",
    },
  }

  const chartData = data.map((item) => ({
    framework: item.framework,
    score: item.score,
    gaps: item.gaps,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="framework" />
          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar yAxisId="left" dataKey="score" fill="var(--color-score)" name="Score" />
          <Bar yAxisId="right" dataKey="gaps" fill="var(--color-gaps)" name="Gaps" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}