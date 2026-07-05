"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { Plus, Trash2, Save, Download, Play, FileText, Filter, Search, Calendar, Clock, BarChart2, PieChart, LineChart, Settings, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface Report {
  id: string
  name: string
  description: string
  type: 'document_analysis' | 'process_efficiency' | 'trend_analysis' | 'custom'
  status: 'draft' | 'generated' | 'scheduled'
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    next_run: string
  }
  created_at: string
  updated_at: string
  created_by: string
  last_generated?: string
  data_source: 'documents' | 'workflows' | 'events' | 'all'
  filters: Record<string, unknown>
  visualization_type: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'summary'
}

interface ReportData {
  columns: string[]
  rows: Array<Record<string, unknown>>
  summary?: {
    total: number
    average: number
    count: number
    insights: string[]
  }
  visualization?: {
    type: string
    data: unknown
    options?: Record<string, unknown>
  }
}

export function OperationalReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentReport, setCurrentReport] = useState<Report | null>(null)
  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    type: 'document_analysis',
    data_source: 'documents',
    visualization_type: 'table',
    filters: {}
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/operations/reports')
      const data = await response.json()
      
      if (response.ok) {
        setReports(data)
      } else {
        toast.error(data.error || 'Failed to load reports')
      }
    } catch (error) {
      toast.error('Error loading reports')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReport = async () => {
    if (!newReport.name.trim()) {
      toast.error('Report name is required')
      return
    }
    
    try {
      setIsCreating(true)
      const response = await fetch('/api/v1/operations/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Report created successfully')
        setNewReport({
          name: '',
          description: '',
          type: 'document_analysis',
          data_source: 'documents',
          visualization_type: 'table',
          filters: {}
        })
        fetchReports()
      } else {
        toast.error(result.error || 'Failed to create report')
      }
    } catch (error) {
      toast.error('Error creating report')
      console.error('Error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerateReport = async (reportId: string) => {
    try {
      setIsGenerating(true)
      const response = await fetch(`/api/v1/operations/reports/${reportId}/generate`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Report generated successfully')
        fetchReports()
        
        // Fetch the generated report data
        const dataResponse = await fetch(`/api/v1/operations/reports/${reportId}/data`)
        const dataResult = await dataResponse.json()
        
        if (dataResponse.ok) {
          setReportData(dataResult)
        }
      } else {
        toast.error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      toast.error('Error generating report')
      console.error('Error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    
    try {
      const response = await fetch(`/api/v1/operations/reports/${reportId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Report deleted successfully')
        fetchReports()
        if (currentReport?.id === reportId) {
          setCurrentReport(null)
          setReportData(null)
        }
      } else {
        toast.error(result.error || 'Failed to delete report')
      }
    } catch (error) {
      toast.error('Error deleting report')
      console.error('Error:', error)
    }
  }

  const handleScheduleReport = async (reportId: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    try {
      const response = await fetch(`/api/v1/operations/reports/${reportId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Report scheduled successfully')
        fetchReports()
      } else {
        toast.error(result.error || 'Failed to schedule report')
      }
    } catch (error) {
      toast.error('Error scheduling report')
      console.error('Error:', error)
    }
  }

  const filteredReports = reports.filter(report =>
    report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(report =>
    filterType === 'all' || report.type === filterType
  )

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'document_analysis': return 'Document Analysis'
      case 'process_efficiency': return 'Process Efficiency'
      case 'trend_analysis': return 'Trend Analysis'
      case 'custom': return 'Custom Report'
      default: return type
    }
  }

  const getDataSourceLabel = (source: string) => {
    switch (source) {
      case 'documents': return 'Documents'
      case 'workflows': return 'Workflows'
      case 'events': return 'Events'
      case 'all': return 'All Data'
      default: return source
    }
  }

  const getVisualizationTypeLabel = (type: string) => {
    switch (type) {
      case 'table': return 'Table'
      case 'bar_chart': return 'Bar Chart'
      case 'line_chart': return 'Line Chart'
      case 'pie_chart': return 'Pie Chart'
      case 'summary': return 'Summary'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>
      case 'generated': return <Badge variant="default">Generated</Badge>
      case 'scheduled': return <Badge variant="default">Scheduled</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const renderReportData = () => {
    if (!reportData) return null
    
    switch (currentReport?.visualization_type) {
      case 'table':
        return (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {reportData.columns.map(column => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.rows.map((row, index) => (
                  <TableRow key={index}>
                    {reportData.columns.map(column => (
                      <TableCell key={column}>{String(row[column])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      
      case 'bar_chart':
        return (
           <ChartContainer>
             <LiveChart
               data={reportData.rows as Record<string, string | number>[]}
               dataKey={Object.keys(reportData.rows[0] || {})[1]}
               type="bar"
               color="hsl(var(--primary))"
               xAxisKey={reportData.columns[0]}
            />
          </ChartContainer>
        )
      
      case 'line_chart':
        return (
          <ChartContainer>
            <LiveChart
               data={reportData.rows as Record<string, string | number>[]}
               dataKey={Object.keys(reportData.rows[0] || {})[1]}
               type="line"
               color="hsl(var(--primary))"
               xAxisKey={reportData.columns[0]}
            />
          </ChartContainer>
        )
      
      case 'pie_chart':
        return (
          <ChartContainer>
            <LiveChart
               data={reportData.rows as Record<string, string | number>[]}
               dataKey={Object.keys(reportData.rows[0] || {})[1]}
               type="area"
               color="hsl(var(--primary))"
               xAxisKey={reportData.columns[0]}
            />
          </ChartContainer>
        )
      
      case 'summary':
        return (
          <div className="space-y-4">
            {reportData.summary?.insights.map((insight, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <p className="text-sm">{insight}</p>
                </CardContent>
              </Card>
            ))}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.summary?.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.summary?.average}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.summary?.count}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      
      default:
        return <div>No visualization type selected</div>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Operational Reports</h2>
          <p className="text-sm text-muted-foreground">Generate custom reports for operational insights</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Report</DialogTitle>
              <DialogDescription>
                Define a new operational report.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={newReport.name}
                  onChange={(e) => setNewReport({...newReport, name: e.target.value})}
                  placeholder="e.g., Monthly Document Processing Report"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-description">Description</Label>
                <Textarea
                  id="report-description"
                  value={newReport.description}
                  onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                  placeholder="Describe the purpose and content of this report..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select
                    value={newReport.type}
                    onValueChange={(value) => setNewReport({...newReport, type: value as any})}
                  >
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document_analysis">Document Analysis</SelectItem>
                      <SelectItem value="process_efficiency">Process Efficiency</SelectItem>
                      <SelectItem value="trend_analysis">Trend Analysis</SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-source">Data Source</Label>
                  <Select
                    value={newReport.data_source}
                    onValueChange={(value) => setNewReport({...newReport, data_source: value as any})}
                  >
                    <SelectTrigger id="data-source">
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="documents">Documents</SelectItem>
                      <SelectItem value="workflows">Workflows</SelectItem>
                      <SelectItem value="events">Events</SelectItem>
                      <SelectItem value="all">All Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visualization-type">Visualization Type</Label>
                <Select
                  value={newReport.visualization_type}
                  onValueChange={(value) => setNewReport({...newReport, visualization_type: value as any})}
                >
                  <SelectTrigger id="visualization-type">
                    <SelectValue placeholder="Select visualization type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="bar_chart">Bar Chart</SelectItem>
                    <SelectItem value="line_chart">Line Chart</SelectItem>
                    <SelectItem value="pie_chart">Pie Chart</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewReport({
                name: '',
                description: '',
                type: 'document_analysis',
                data_source: 'documents',
                visualization_type: 'table',
                filters: {}
              })}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateReport} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Report'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="document_analysis">Document Analysis</SelectItem>
            <SelectItem value="process_efficiency">Process Efficiency</SelectItem>
            <SelectItem value="trend_analysis">Trend Analysis</SelectItem>
            <SelectItem value="custom">Custom Report</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">My Reports</TabsTrigger>
          {currentReport && <TabsTrigger value="preview">Report Preview</TabsTrigger>}
        </TabsList>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Available Reports</CardTitle>
              <CardDescription>Manage and generate operational reports</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Data Source</TableHead>
                        <TableHead>Visualization</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Generated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.length > 0 ? (
                        filteredReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.name}</TableCell>
                            <TableCell>{getReportTypeLabel(report.type)}</TableCell>
                            <TableCell>{getDataSourceLabel(report.data_source)}</TableCell>
                            <TableCell>{getVisualizationTypeLabel(report.visualization_type)}</TableCell>
                            <TableCell>{getStatusBadge(report.status)}</TableCell>
                            <TableCell>
                              {report.last_generated ? new Date(report.last_generated).toLocaleString() : 'Never'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCurrentReport(report)
                                    handleGenerateReport(report.id)
                                  }}
                                  disabled={isGenerating}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  {isGenerating && currentReport?.id === report.id ? 'Generating...' : 'Generate'}
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={() => setCurrentReport(report)}>
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Report Settings: {report.name}</DialogTitle>
                                      <DialogDescription>
                                        Configure report settings and schedule.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-report-name">Report Name</Label>
                                        <Input
                                          id="edit-report-name"
                                          value={currentReport?.name || ''}
                                          onChange={(e) => setCurrentReport(currentReport ? {...currentReport, name: e.target.value} : null)}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-report-description">Description</Label>
                                        <Textarea
                                          id="edit-report-description"
                                          value={currentReport?.description || ''}
                                          onChange={(e) => setCurrentReport(currentReport ? {...currentReport, description: e.target.value} : null)}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Schedule</Label>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant={report.status === 'scheduled' && report.schedule?.frequency === 'daily' ? 'default' : 'outline'}
                                            onClick={() => handleScheduleReport(report.id, 'daily')}
                                          >
                                            Daily
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={report.status === 'scheduled' && report.schedule?.frequency === 'weekly' ? 'default' : 'outline'}
                                            onClick={() => handleScheduleReport(report.id, 'weekly')}
                                          >
                                            Weekly
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={report.status === 'scheduled' && report.schedule?.frequency === 'monthly' ? 'default' : 'outline'}
                                            onClick={() => handleScheduleReport(report.id, 'monthly')}
                                          >
                                            Monthly
                                          </Button>
                                        </div>
                                        {report.status === 'scheduled' && report.schedule && (
                                          <div className="text-sm text-muted-foreground">
                                            Next run: {new Date(report.schedule.next_run).toLocaleString()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setCurrentReport(null)}>
                                        Close
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteReport(report.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            No reports found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {currentReport && (
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{currentReport.name}</CardTitle>
                    <CardDescription>{currentReport.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                    <Button>
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Generated: {new Date().toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Data Source: {getDataSourceLabel(currentReport.data_source)}</span>
                    </div>
                  </div>
                  
                  {renderReportData()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}