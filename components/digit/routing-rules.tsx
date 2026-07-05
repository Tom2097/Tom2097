"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface RoutingRulesProps {
  workspaces: Array<{ id: string; name: string; vertical: string }>
  initialRules?: {
    categories?: Record<string, string>
    intent?: Record<string, string>
  }
}

export function RoutingRules({ workspaces, initialRules = {} }: RoutingRulesProps) {
  const [categoryRules, setCategoryRules] = useState<Record<string, string>>(initialRules.categories || {})
  const [intentRules, setIntentRules] = useState<Record<string, string>>(initialRules.intent || {})
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryTarget, setNewCategoryTarget] = useState('')
  const [newIntent, setNewIntent] = useState('')
  const [newIntentTarget, setNewIntentTarget] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

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
          data: {
            rules: {
              categories: categoryRules,
              intent: intentRules
            }
          }
        })
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success('Routing rules saved successfully')
        router.refresh()
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Classification-Based Routing</h3>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Rules'}
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Route documents based on their content classification (e.g., "legal", "finance", "healthcare").
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
            <Select value={newCategoryTarget} onValueChange={setNewCategoryTarget}>
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
            <Button onClick={addCategoryRule}>
              <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Intent-Based Routing</h3>
          <p className="text-sm text-muted-foreground">
            Route documents based on detected intent (e.g., "contract review", "financial report").
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
            <Select value={newIntentTarget} onValueChange={setNewIntentTarget}>
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
            <Button onClick={addIntentRule}>
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
            <Input placeholder="Enter document text to test routing" className="flex-1" />
            <Button>
              <RefreshCw className="h-4 w-4 mr-2" /> Test Routing
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}