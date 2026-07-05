"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, CheckCircle2, Clock, Play, Plus, Trash2, Save, History } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface RetentionPolicy {
  id: string
  retention_period_days: number
  apply_to: 'all' | 'auth' | 'document' | 'crm' | 'billing' | 'system'
  is_active: boolean
}

export function AuditRetention() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [history, setHistory] = useState<Array<{
    id: string
    deleted_count: number
    retention_policies_applied: number
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [newPolicy, setNewPolicy] = useState<Omit<RetentionPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>({
    retention_period_days: 365,
    apply_to: 'all',
    is_active: true
  })

  useEffect(() => {
    fetchRetentionData()
  }, [])

  const fetchRetentionData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/audit/retention')
      const data = await response.json()
      
      if (response.ok) {
        setPolicies(data.policies)
        setHistory(data.history)
      } else {
        toast.error(data.error || 'Failed to load retention policies')
      }
    } catch (error) {
      toast.error('Error loading retention policies')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePolicies = async () => {
    try {
      setIsSaving(true)
      const response = await fetch('/api/v1/audit/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          policies: policies.map(policy => ({
            retention_period_days: policy.retention_period_days,
            apply_to: policy.apply_to,
            is_active: policy.is_active
          }))
        })
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success('Retention policies saved successfully')
        fetchRetentionData()
      } else {
        toast.error(result.error || 'Failed to save retention policies')
      }
    } catch (error) {
      toast.error('Error saving retention policies')
      console.error('Error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRunCleanup = async () => {
    try {
      setIsRunning(true)
      const response = await fetch('/api/v1/audit/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(`Retention cleanup completed: ${result.deletedCount} logs deleted`)
        fetchRetentionData()
      } else {
        toast.error(result.error || 'Failed to run retention cleanup')
      }
    } catch (error) {
      toast.error('Error running retention cleanup')
      console.error('Error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const addPolicy = () => {
    setPolicies([...policies, {
      id: `new-${Date.now()}`,
      organization_id: '', // Will be set on server
      created_at: '', // Will be set on server
      updated_at: '', // Will be set on server
      ...newPolicy
    } as RetentionPolicy])
    
    // Reset new policy form
    setNewPolicy({
      retention_period_days: 365,
      apply_to: 'all',
      is_active: true
    })
  }

  const updatePolicy = (id: string, updates: Partial<RetentionPolicy>) => {
    setPolicies(policies.map(policy =>
      policy.id === id ? { ...policy, ...updates } : policy
    ))
  }

  const removePolicy = (id: string) => {
    setPolicies(policies.filter(policy => policy.id !== id))
  }

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'all': return 'All Logs'
      case 'auth': return 'Authentication'
      case 'document': return 'Documents'
      case 'crm': return 'CRM'
      case 'billing': return 'Billing'
      case 'system': return 'System'
      default: return scope
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Log Retention</h2>
          <p className="text-sm text-muted-foreground">Manage retention policies for audit logs</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" /> View History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Retention Cleanup History</DialogTitle>
                <DialogDescription>
                  Recent retention cleanup operations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {history.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Logs Deleted</TableHead>
                        <TableHead>Policies Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                          <TableCell>{entry.deleted_count}</TableCell>
                          <TableCell>{entry.retention_policies_applied}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    No retention history found
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleRunCleanup} disabled={isRunning}>
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running...' : 'Run Cleanup Now'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
          <CardDescription>
            Configure how long audit logs are retained before automatic deletion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Retention Period</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <Input
                            type="number"
                            value={policy.retention_period_days}
                            onChange={(e) => updatePolicy(policy.id, { retention_period_days: Number(e.target.value) })}
                            className="w-24"
                            min={1}
                          /> days
                        </TableCell>
                        <TableCell>
                          <Select
                            value={policy.apply_to}
                            onValueChange={(value) => updatePolicy(policy.id, { apply_to: value as any })}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Logs</SelectItem>
                              <SelectItem value="auth">Authentication</SelectItem>
                              <SelectItem value="document">Documents</SelectItem>
                              <SelectItem value="crm">CRM</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={policy.is_active}
                            onCheckedChange={(checked) => updatePolicy(policy.id, { is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePolicy(policy.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Add New Policy</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="retention-days">Retention Period (days)</Label>
                    <Input
                      id="retention-days"
                      type="number"
                      value={newPolicy.retention_period_days}
                      onChange={(e) => setNewPolicy({...newPolicy, retention_period_days: Number(e.target.value)})}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policy-scope">Scope</Label>
                    <Select
                      value={newPolicy.apply_to}
                      onValueChange={(value) => setNewPolicy({...newPolicy, apply_to: value as any})}
                    >
                      <SelectTrigger id="policy-scope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Logs</SelectItem>
                        <SelectItem value="auth">Authentication</SelectItem>
                        <SelectItem value="document">Documents</SelectItem>
                        <SelectItem value="crm">CRM</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policy-active">Active</Label>
                    <Switch
                      id="policy-active"
                      checked={newPolicy.is_active}
                      onCheckedChange={(checked) => setNewPolicy({...newPolicy, is_active: checked})}
                    />
                  </div>
                  <Button onClick={addPolicy}>
                    <Plus className="h-4 w-4 mr-2" /> Add Policy
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePolicies} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Policies'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention Summary</CardTitle>
          <CardDescription>
            Current retention settings overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {policies.map((policy) => (
              <Card key={policy.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {getScopeLabel(policy.apply_to)}
                    {policy.is_active ? (
                      <CheckCircle2 className="h-5 w-5 text-success ml-2 inline" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning ml-2 inline" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Retention Period:</span>
                      <span className="font-medium">{policy.retention_period_days} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Cutoff Date:</span>
                      <span className="font-medium">
                        {new Date(Date.now() - policy.retention_period_days * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}