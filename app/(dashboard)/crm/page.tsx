'use client'

import { useState } from 'react'
import { 
  Users, 
  TrendingUp, 
  Target,
  UserPlus,
  Mail,
  Phone,
  MoreHorizontal,
  Search,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { generatePipelineData } from '@/lib/mock-data'

const leads = [
  { id: 1, name: 'Acme Corporation', contact: 'John Smith', email: 'john@acme.com', value: '$125,000', stage: 'Negotiation', score: 92 },
  { id: 2, name: 'TechStart Inc', contact: 'Sarah Johnson', email: 'sarah@techstart.io', value: '$85,000', stage: 'Proposal', score: 78 },
  { id: 3, name: 'Global Systems', contact: 'Mike Chen', email: 'mike@globalsys.com', value: '$210,000', stage: 'Qualified', score: 85 },
  { id: 4, name: 'InnovateCo', contact: 'Emily Davis', email: 'emily@innovate.co', value: '$156,000', stage: 'Lead', score: 65 },
  { id: 5, name: 'DataFlow Ltd', contact: 'James Wilson', email: 'james@dataflow.uk', value: '$92,000', stage: 'Proposal', score: 71 },
]

export default function CRMPage() {
  const [pipelineData] = useState(generatePipelineData())
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.contact.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-2/20 text-chart-2">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart CRM</h1>
            <p className="text-sm text-muted-foreground">AI-driven customer management and engagement</p>
          </div>
        </div>
        
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Total Leads" 
          value="1,247"
          change={12}
          trend="up"
          variant="highlight"
        />
        <MetricCard 
          label="Conversion Rate" 
          value="24.8%"
          change={3.2}
          trend="up"
        />
        <MetricCard 
          label="Pipeline Value" 
          value="$2.4M"
          change={8}
          trend="up"
        />
        <MetricCard 
          label="Avg Deal Size" 
          value="$45.2K"
          change={-2}
          trend="down"
        />
      </MetricGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer 
          title="Sales Pipeline" 
          subtitle="Lead progression through sales stages"
        >
          <LiveChart 
            data={pipelineData}
            dataKey="value"
            type="bar"
            height={280}
            color="hsl(var(--chart-2))"
          />
        </ChartContainer>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">AI Recommendations</h3>
          <div className="space-y-3">
            {[
              { action: 'Follow up with Acme Corp', priority: 'High', reason: 'No contact in 5 days' },
              { action: 'Send proposal to TechStart', priority: 'Medium', reason: 'Showed high interest' },
              { action: 'Schedule demo for Global Systems', priority: 'High', reason: 'Decision maker engaged' },
            ].map((rec, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div>
                  <p className="font-medium text-foreground">{rec.action}</p>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  rec.priority === 'High' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {rec.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-foreground">Active Leads</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search leads..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Contact</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Value</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Stage</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">AI Score</th>
                <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-secondary/30">
                  <td className="py-4">
                    <p className="font-medium text-foreground">{lead.name}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-sm text-foreground">{lead.contact}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="py-4 text-sm font-medium text-foreground">{lead.value}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-12 overflow-hidden rounded-full bg-secondary">
                        <div 
                          className={`h-full ${lead.score >= 80 ? 'bg-emerald-500' : lead.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${lead.score}%` }} 
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{lead.score}</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
