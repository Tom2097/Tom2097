"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, TrendingUp, TrendingDown, AlertTriangle, Target, ArrowUp, ArrowDown } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"
import { format, subDays } from "date-fns"

/**
 * Performance Dashboard Page
 * 
 * Displays dynamic analytics data with interactive charts and filters
 */
export default function PerformanceDashboard() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "90d" | "custom">("7d")
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: subDays(new Date(), 7), to: new Date() })
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<any>(null)
  const [forecastData, setForecastData] = useState<any>(null)
  const [anomaliesData, setAnomaliesData] = useState<any>(null)
  const [metricsData, setMetricsData] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(undefined)

  // Fetch data based on current filters
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set("timeRange", timeRange)
        if (timeRange === "custom") {
          params.set("customStart", customRange.from.toISOString())
          params.set("customEnd", customRange.to.toISOString())
        }
        if (selectedEvent) {
          params.set("eventName", selectedEvent)
        }

        // Fetch all data in parallel
        const [overviewRes, forecastRes, anomaliesRes, metricsRes] = await Promise.all([
          fetch(`/api/v1/analytics/overview?${params.toString()}`),
          selectedEvent ? fetch(`/api/v1/analytics/forecast?eventName=${selectedEvent}&start=${timeRange === "custom" ? customRange.from.toISOString() : subDays(new Date(), getDaysInRange(timeRange)).toISOString()}&end=${timeRange === "custom" ? customRange.to.toISOString() : new Date().toISOString()}`) : Promise.resolve(null),
          fetch(`/api/v1/analytics/anomalies?start=${timeRange === "custom" ? customRange.from.toISOString() : subDays(new Date(), getDaysInRange(timeRange)).toISOString()}&end=${timeRange === "custom" ? customRange.to.toISOString() : new Date().toISOString()}`),
          fetch(`/api/v1/analytics/metrics?start=${timeRange === "custom" ? customRange.from.toISOString() : subDays(new Date(), getDaysInRange(timeRange)).toISOString()}&end=${timeRange === "custom" ? customRange.to.toISOString() : new Date().toISOString()}`),
        ])

        const [overviewJson, forecastJson, anomaliesJson, metricsJson] = await Promise.all([
          overviewRes?.json(),
          forecastRes?.json(),
          anomaliesRes.json(),
          metricsRes.json(),
        ])

        if (overviewJson?.success) setOverviewData(overviewJson.data)
        if (forecastJson?.success) setForecastData(forecastJson.data)
        if (anomaliesJson?.success) setAnomaliesData(anomaliesJson.data)
        if (metricsJson?.success) setMetricsData(metricsJson.data)
      } catch (err) {
        setError("Failed to fetch analytics data")
        console.error("Error fetching data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [timeRange, customRange, selectedEvent])

  // Helper to get number of days in a time range
  const getDaysInRange = (range: "today" | "7d" | "30d" | "90d" | "custom") => {
    switch (range) {
      case "today": return 1
      case "7d": return 7
      case "30d": return 30
      case "90d": return 90
      default: return 7
    }
  }

  // Format data for charts
  const formatChartData = (data: any) => {
    if (!data) return []
    return data.map((item: any) => ({
      ...item,
      date: format(new Date(item.bucket), "MMM dd"),
    }))
  }

  // Get top events for event selector
  const topEvents = overviewData?.metrics?.topEvents || []

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <div className="flex items-center gap-4">
          {topEvents.length > 0 && (
            <Select onValueChange={setSelectedEvent} value={selectedEvent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {topEvents.map((event: any) => (
                  <SelectItem key={event.event_name} value={event.event_name}>
                    {event.event_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DateRangePicker
            onUpdate={(values) => {
              if (values.range === "custom") {
                setTimeRange("custom")
                setCustomRange({ from: values.from, to: values.to })
              } else {
                setTimeRange(values.range as any)
              }
            }}
            initialDateFrom={subDays(new Date(), getDaysInRange(timeRange))}
            initialDateTo={new Date()}
            align="end"
            locale="en-US"
            showCompare={false}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overviewData?.metrics?.totalEvents?.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {overviewData?.metrics?.growthRate >= 0 ? (
                      <span className="text-green-600 flex items-center">
                        <ArrowUp className="h-4 w-4 mr-1" /> {Math.round(overviewData.metrics.growthRate * 100)}% from last period
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <ArrowDown className="h-4 w-4 mr-1" /> {Math.round(Math.abs(overviewData.metrics.growthRate) * 100)}% from last period
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overviewData?.metrics?.uniqueUsers?.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {overviewData?.metrics?.eventsPerUser?.toFixed(1)} events per user
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overviewData?.anomalies?.summary?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {overviewData?.anomalies?.summary?.bySeverity?.critical || 0} critical
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(overviewData?.metrics?.retentionRate)}%</div>
                  <p className="text-xs text-muted-foreground">7-day retention</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Event Trends</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formatChartData(overviewData?.timeseries)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" name="Events" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {overviewData?.metrics?.topEvents?.map((event: any) => (
                      <div key={event.event_name} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{event.event_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{event.count.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="space-y-4">
            {forecastData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Forecasted Trends</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formatChartData([...overviewData?.timeseries, ...forecastData.forecast])}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" name="Historical" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="value" name="Forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                        {forecastData.confidenceIntervals?.map((ci: any, i: number) => (
                          <Line key={i} type="monotone" dataKey="" name="Confidence" stroke="#d1d5db" strokeWidth={1} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Forecast Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <p className="text-lg font-medium flex items-center">
                          {forecastData.trend === "increasing" ? (
                            <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                          ) : forecastData.trend === "decreasing" ? (
                            <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
                          ) : (
                            <div className="h-5 w-5 mr-2" />
                          )}
                          {forecastData.trend}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Seasonality</p>
                        <p className="text-lg font-medium">{forecastData.seasonality}</p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Model Accuracy</p>
                        <p className="text-lg font-medium">
                          {forecastData.modelMetrics?.rSquared ? `${Math.round(forecastData.modelMetrics.rSquared * 100)}%` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Select an event to view forecast</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4">
            {anomaliesData?.anomalies?.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Anomaly Detection</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formatChartData(overviewData?.timeseries)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" name="Events" stroke="#3b82f6" strokeWidth={2} />
                        {anomaliesData.anomalies.map((anomaly: any) => (
                          <ReferenceLine
                            key={anomaly.id}
                            x={format(new Date(anomaly.bucket), "MMM dd")}
                            stroke={anomaly.severity === "critical" ? "#ef4444" : anomaly.severity === "high" ? "#f97316" : "#eab308"}
                            label={{ value: anomaly.type, position: "top" }}
                            ifOverlap="extendDomain"
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Anomalies Found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total Anomalies</span>
                        <span className="font-bold">{anomaliesData.summary.total}</span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">By Severity</p>
                        {Object.entries(anomaliesData.summary.bySeverity).map(([severity, count]) => (
                          <div key={severity} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className={`h-3 w-3 rounded-full mr-2 ${severity === "critical" ? "bg-red-500" : severity === "high" ? "bg-orange-500" : severity === "medium" ? "bg-yellow-500" : "bg-gray-500"}`} />
                              <span className="text-sm capitalize">{severity}</span>
                            </div>
                            <span>{count as number}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">By Type</p>
                        {Object.entries(anomaliesData.summary.byType).map(([type, count]) => (
                          <div key={type} className="flex justify-between">
                            <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                            <span>{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No anomalies detected in the selected period</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {metricsData?.map((metric: any) => (
                <Card key={metric.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                    <div className={`h-4 w-4 rounded-full ${metric.comparison.isImproving ? "bg-green-500" : "bg-red-500"}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.currentValue.toLocaleString()}{metric.unit}</div>
                    <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                    <div className="mt-4 flex justify-between items-center">
                      <div className={`flex items-center ${metric.comparison.changePercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {metric.comparison.changePercentage >= 0 ? (
                          <ArrowUp className="h-4 w-4 mr-1" />
                        ) : (
                          <ArrowDown className="h-4 w-4 mr-1" />
                        )}
                        <span className="text-sm">{Math.abs(metric.comparison.changePercentage).toFixed(1)}%</span>
                      </div>
                      {metric.target && (
                        <div className="flex items-center text-sm">
                          <Target className="h-4 w-4 mr-1" />
                          <span>{metric.targetMet ? "Target met" : "Target not met"}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 h-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formatChartData(metric.timeseries)}>
                          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}