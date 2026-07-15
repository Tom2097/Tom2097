"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RoutingSuggestion {
  workspaceId: string
  workspaceName: string
  confidence: number
  reason: string
}

export function RoutingRules() {
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; vertical: string }>>([])
  const [categoryRules, setCategoryRules] = useState<Record<string, string>>({})
  const [intentRules, setIntentRules] = useState<Record<string, string>>({})
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryTarget, setNewCategoryTarget] = useState('')
  const [newIntent, setNewIntent] = useState('')
  const [newIntentTarget, setNewIntentTarget] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [testText, setTestText] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<RoutingSuggestion[] | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [workspacesRes, rulesRes] = await Promise.all([
          fetch('/api/v1/workspaces'),
          fetch('/api/v1/routing'),
        ])
        const workspacesData = await workspacesRes.json()
        const rulesData = await rulesRes.json()
        if (workspacesRes.ok) setWorkspaces(workspacesData.workspaces ?? [])
        if (rulesRes.ok) {
          setCategoryRules(rulesData.rules?.categories ?? {})
          setIntentRules(rulesData.rules?.intent ?? {})
        }
      } catch (error) {
        console.error('Error loading routing configuration:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const workspaceOptions = workspaces.map(ws => ({
    value: ws.id,
    label: `${ws.name} (${ws.vertical})`,
    vertical: ws.vertical
  }))

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/v1/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-rules',
          rules: {
            categories: categoryRules,
            intent: intentRules
          }
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('Routing rules saved successfully')
      } else {
        toast.error(result.error || 'Failed to save routing rules')
      }
    } catch (error) {
      toast.error('Error saving routing rules')
      console.error('Error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestRouting = async () => {
    if (!testText.trim()) return
    setIsTesting(true)
    setTestResults(null)
    try {
      const response = await fetch('/api/v1/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-routing', content: testText }),
      })
      const result = await response.json()
      if (response.ok) {
        setTestResults(result.suggestions ?? [])
      } else {
        toast.error(result.error || 'Failed to test routing')
      }
    } catch (error) {
      toast.error('Error testing routing')
      console.error('Error:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const addCategoryRule = () => {
    if (!newCategory || !newCategoryTarget) return
    
    setCategoryRules({
      ...categoryRules,
      [newCategory.toLowerCase()]: newCategoryTarget
    })
    
    setNewCategory('')
    setNewCategoryTarget('')
  }

  const addIntentRule = () => {
    if (!newIntent || !newIntentTarget) return
    
    setIntentRules({
      ...intentRules,
      [newIntent.toLowerCase()]: newIntentTarget
    })
    
    setNewIntent('')
    setNewIntentTarget('')
  }

  const removeCategoryRule = (category: string) => {
    const newRules = { ...categoryRules }
    delete newRules[category]
    setCategoryRules(newRules)
  }

  const removeIntentRule = (intent: string) => {
    const newRules = { ...intentRules }
    delete newRules[intent]
    setIntentRules(newRules)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Dynamic Auto-Routing Rules</CardTitle>
        <CardDescription>
          Configure rules to automatically route documents to the appropriate workspace based on content analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isLoading && workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
            No workspaces yet — create one from the Workspaces tab before setting up routing rules.
          </p>
        )}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Classification-Based Routing</h3>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isSaving ? 'Saving...' : 'Save Rules'}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Route documents based on their content classification (e.g., &quot;legal&quot;, &quot;finance&quot;).
          </p>

           <div className="space-y-3">
             {Object.entries(categoryRules).map(([category, target]) => {
               const workspace = workspaces.find(ws => ws.id === target)
               return (
                 <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                   <div>
                     <div className="font-medium">{category}</div>
                     <div className="text-sm text-muted-foreground">
                       → {workspace ? `${workspace.name} (${workspace.vertical})` : target}
                     </div>
                   </div>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => removeCategoryRule(category)}
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>
               )
             })}
           </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Document category (e.g., legal, finance)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1"
            />
            <Select value={newCategoryTarget} onValueChange={setNewCategoryTarget} disabled={workspaces.length === 0}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addCategoryRule} disabled={!newCategory || !newCategoryTarget}>
              <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Intent-Based Routing</h3>
          <p className="text-sm text-muted-foreground">
            Route documents based on detected intent (e.g., &quot;contract review&quot;, &quot;financial report&quot;).
          </p>
          
           <div className="space-y-3">
             {Object.entries(intentRules).map(([intent, target]) => {
               const workspace = workspaces.find(ws => ws.id === target)
               return (
                 <div key={intent} className="flex items-center justify-between p-3 border rounded-lg">
                   <div>
                     <div className="font-medium">{intent}</div>
                     <div className="text-sm text-muted-foreground">
                       → {workspace ? `${workspace.name} (${workspace.vertical})` : target}
                     </div>
                   </div>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => removeIntentRule(intent)}
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>
               )
             })}
           </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Document intent (e.g., contract review, financial report)"
              value={newIntent}
              onChange={(e) => setNewIntent(e.target.value)}
              className="flex-1"
            />
            <Select value={newIntentTarget} onValueChange={setNewIntentTarget} disabled={workspaces.length === 0}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addIntentRule} disabled={!newIntent || !newIntentTarget}>
              <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Test Routing Rules</h3>
          <p className="text-sm text-muted-foreground">
            Test how a document would be routed based on its content.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Enter document text to test routing"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTestRouting} disabled={!testText.trim() || isTesting}>
              {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Test Routing
            </Button>
          </div>

          {testResults && (
            testResults.length > 0 ? (
              <div className="space-y-2">
                {testResults.map((s) => (
                  <div key={s.workspaceId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{s.workspaceName}</div>
                      <div className="text-sm text-muted-foreground">{s.reason}</div>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">{Math.round(s.confidence * 100)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No workspace suggestions for this content.</p>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}