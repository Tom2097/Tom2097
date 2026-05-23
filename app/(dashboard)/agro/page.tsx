'use client'

import { useState } from 'react'
import { 
  Wheat, 
  CloudRain,
  Sun,
  Thermometer,
  Droplets,
  Truck,
  MapPin,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart, MultiLineChart } from '@/components/digit/live-chart'
import { generateTimeSeriesData } from '@/lib/mock-data'

const cropStatus = [
  { crop: 'Wheat', acreage: '12,500', health: 94, yield: '+12%', status: 'Excellent' },
  { crop: 'Corn', acreage: '8,200', health: 87, yield: '+8%', status: 'Good' },
  { crop: 'Soybeans', acreage: '6,800', health: 91, yield: '+15%', status: 'Excellent' },
  { crop: 'Rice', acreage: '4,500', health: 78, yield: '-3%', status: 'Moderate' },
]

const supplyChainStatus = [
  { route: 'Farm to Processing', status: 'On Track', eta: '2 hours', trucks: 12 },
  { route: 'Processing to Distribution', status: 'Delayed', eta: '4 hours', trucks: 8 },
  { route: 'Distribution to Retail', status: 'On Track', eta: '6 hours', trucks: 24 },
]

const weatherData = [
  { day: 'Mon', temp: 72, humidity: 65, rain: 10 },
  { day: 'Tue', temp: 75, humidity: 58, rain: 0 },
  { day: 'Wed', temp: 78, humidity: 52, rain: 0 },
  { day: 'Thu', temp: 74, humidity: 70, rain: 40 },
  { day: 'Fri', temp: 68, humidity: 80, rain: 60 },
  { day: 'Sat', temp: 70, humidity: 72, rain: 30 },
  { day: 'Sun', temp: 73, humidity: 62, rain: 5 },
]

export default function AgroPage() {
  const [yieldData] = useState(generateTimeSeriesData(12, 85, 15).map((d, i) => ({
    name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    value: d.value
  })))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-5/20 text-chart-5">
            <Wheat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agro-Tech Systems</h1>
            <p className="text-sm text-muted-foreground">AI systems for agriculture and supply chains</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <MapPin className="h-4 w-4" />
            Field Map
          </Button>
          <Button className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Yield Forecast" 
          value="+11.5%"
          subtitle="Above seasonal average"
          change={3.2}
          trend="up"
          variant="highlight"
        />
        <MetricCard 
          label="Active Acreage" 
          value="32,000"
          subtitle="Across 4 crop types"
          trend="stable"
        />
        <MetricCard 
          label="Climate Risk" 
          value="Low"
          subtitle="No severe weather expected"
          trend="stable"
        />
        <MetricCard 
          label="Supply Chain" 
          value="94%"
          subtitle="On-time delivery rate"
          change={2}
          trend="up"
        />
      </MetricGrid>

      {/* Weather and Yield */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer 
          title="7-Day Weather Forecast" 
          subtitle="Temperature and precipitation outlook"
        >
          <MultiLineChart 
            data={weatherData}
            lines={[
              { dataKey: 'temp', color: 'hsl(var(--chart-5))', name: 'Temperature (F)' },
              { dataKey: 'rain', color: 'hsl(var(--chart-1))', name: 'Rain (%)' }
            ]}
            height={280}
          />
        </ChartContainer>

        <ChartContainer 
          title="Yield Performance" 
          subtitle="Monthly yield index (baseline: 80)"
        >
          <LiveChart 
            data={yieldData}
            dataKey="value"
            type="area"
            height={280}
            color="hsl(var(--chart-5))"
          />
        </ChartContainer>
      </div>

      {/* Crop Status and Supply Chain */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Crop Status */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Crop Health Status</h3>
          <div className="space-y-4">
            {cropStatus.map((crop) => (
              <div key={crop.crop} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    crop.health >= 90 ? 'bg-emerald-500/20 text-emerald-500' :
                    crop.health >= 80 ? 'bg-amber-500/20 text-amber-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    <Wheat className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{crop.crop}</p>
                    <p className="text-sm text-muted-foreground">{crop.acreage} acres</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                      <div 
                        className={`h-full ${crop.health >= 90 ? 'bg-emerald-500' : crop.health >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${crop.health}%` }} 
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground">{crop.health}%</span>
                  </div>
                  <p className={`text-sm ${crop.yield.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {crop.yield} yield
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supply Chain */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Supply Chain Status</h3>
          </div>
          <div className="space-y-4">
            {supplyChainStatus.map((route) => (
              <div key={route.route} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{route.route}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    route.status === 'On Track' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {route.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>ETA: {route.eta}</span>
                  <span>{route.trucks} trucks active</span>
                </div>
              </div>
            ))}
          </div>

          {/* Current Conditions */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-secondary/30 p-3 text-center">
              <Sun className="mx-auto h-5 w-5 text-amber-500" />
              <p className="mt-1 text-lg font-bold text-foreground">75 F</p>
              <p className="text-xs text-muted-foreground">Temperature</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3 text-center">
              <Droplets className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1 text-lg font-bold text-foreground">62%</p>
              <p className="text-xs text-muted-foreground">Humidity</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3 text-center">
              <CloudRain className="mx-auto h-5 w-5 text-slate-500" />
              <p className="mt-1 text-lg font-bold text-foreground">10%</p>
              <p className="text-xs text-muted-foreground">Rain Chance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
