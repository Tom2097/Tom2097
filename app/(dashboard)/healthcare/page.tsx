'use client'

import { useState } from 'react'
import { 
  Heart, 
  Activity,
  BedDouble,
  Users,
  Clock,
  AlertCircle,
  Stethoscope,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart, MultiLineChart } from '@/components/digit/live-chart'
import { generateOperationalMetrics } from '@/lib/mock-data'

const patientQueue = [
  { id: 1, name: 'Robert Johnson', age: 45, condition: 'Cardiac Evaluation', priority: 'High', waitTime: '12 min' },
  { id: 2, name: 'Maria Garcia', age: 32, condition: 'General Checkup', priority: 'Low', waitTime: '28 min' },
  { id: 3, name: 'David Lee', age: 58, condition: 'Diabetes Follow-up', priority: 'Medium', waitTime: '15 min' },
  { id: 4, name: 'Susan Chen', age: 67, condition: 'Post-Surgery Review', priority: 'High', waitTime: '5 min' },
]

const departmentStats = [
  { name: 'Emergency', occupancy: 78, patients: 24 },
  { name: 'ICU', occupancy: 92, patients: 18 },
  { name: 'Surgery', occupancy: 65, patients: 12 },
  { name: 'Pediatrics', occupancy: 54, patients: 28 },
  { name: 'Cardiology', occupancy: 71, patients: 15 },
]

export default function HealthcarePage() {
  const [resourceData] = useState(generateOperationalMetrics())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/20 text-chart-3">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Healthcare AI</h1>
            <p className="text-sm text-muted-foreground">AI systems for hospitals and healthcare operations</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </Button>
          <Button className="gap-2">
            <Stethoscope className="h-4 w-4" />
            New Patient
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Bed Occupancy" 
          value="76%"
          change={4}
          trend="up"
          variant="highlight"
        />
        <MetricCard 
          label="Patients Today" 
          value="247"
          change={12}
          trend="up"
        />
        <MetricCard 
          label="Avg Wait Time" 
          value="18 min"
          change={-8}
          trend="down"
        />
        <MetricCard 
          label="Staff on Duty" 
          value="142"
          subtitle="24 physicians, 118 nurses"
        />
      </MetricGrid>

      {/* Charts and Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartContainer 
          title="Resource Utilization" 
          subtitle="24-hour equipment and staff metrics"
          className="lg:col-span-2"
        >
          <MultiLineChart 
            data={resourceData}
            lines={[
              { dataKey: 'cpu', color: 'hsl(var(--chart-3))', name: 'Equipment' },
              { dataKey: 'memory', color: 'hsl(var(--chart-2))', name: 'Staff' },
              { dataKey: 'network', color: 'hsl(var(--chart-1))', name: 'Beds' }
            ]}
            height={280}
          />
        </ChartContainer>

        {/* Department Stats */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Department Status</h3>
          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div key={dept.name} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{dept.name}</p>
                  <p className="text-xs text-muted-foreground">{dept.patients} patients</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                    <div 
                      className={`h-full ${dept.occupancy >= 85 ? 'bg-red-500' : dept.occupancy >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${dept.occupancy}%` }} 
                    />
                  </div>
                  <span className="w-12 text-right text-sm text-muted-foreground">{dept.occupancy}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Queue and Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient Queue */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Patient Queue</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {patientQueue.length} waiting
            </span>
          </div>
          <div className="space-y-3">
            {patientQueue.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    patient.priority === 'High' ? 'bg-red-500/20 text-red-500' :
                    patient.priority === 'Medium' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{patient.name}, {patient.age}</p>
                    <p className="text-sm text-muted-foreground">{patient.condition}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {patient.waitTime}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Alerts */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-foreground">AI Health Alerts</h3>
          </div>
          <div className="space-y-3">
            {[
              { alert: 'ICU capacity reaching critical', severity: 'Critical', time: '2 min ago' },
              { alert: 'Medication restock needed - Ward B', severity: 'Warning', time: '15 min ago' },
              { alert: 'Unusual vitals detected - Room 304', severity: 'Alert', time: '28 min ago' },
              { alert: 'Staff shortage predicted - Night shift', severity: 'Warning', time: '1 hour ago' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-4 ${
                item.severity === 'Critical' ? 'border-red-500/30 bg-red-500/10' :
                item.severity === 'Alert' ? 'border-amber-500/30 bg-amber-500/10' :
                'border-border/50 bg-secondary/30'
              }`}>
                <div className="flex items-start justify-between">
                  <p className="font-medium text-foreground">{item.alert}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.severity === 'Critical' ? 'bg-red-500/20 text-red-500' :
                    item.severity === 'Alert' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {item.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
