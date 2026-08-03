"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LiveChart } from '@/components/digit/live-chart'
import { AlertTriangle, CheckCircle2, Info, Brain, BarChart2, Target, Clock, Play, Plus, Trash2, Save, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface Model {
  id: string
  name: string
  description: string
  type: 'regression' | 'classification' | 'time_series' | 'clustering'
  status: 'draft' | 'training' | 'trained' | 'deployed' | 'failed'
  created_at: string
  updated_at: string
  performance_metrics?: {
    accuracy?: number
    precision?: number
    recall?: number
    f1_score?: number
    rmse?: number
    mae?: number
    r2?: number
  }
  training_data?: {
    size: number
    features: number
    samples: number
    feature_columns?: string[]
  }
  deployment_info?: {
    endpoint?: string
    last_deployed?: string
  }
}

interface Dataset {
  id: string
  name: string
  description: string
  size: number
  features: number
  samples: number
  file_type: string
  created_at: string
}

export function PredictiveModeling() {
  const [models, setModels] = useState<Model[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [currentModel, setCurrentModel] = useState<Model | null>(null)
  const [newModel, setNewModel] = useState({
    name: '',
    description: '',
    type: 'regression',
    dataset_id: ''
  })
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null)
  const [trainingProgress, setTrainingProgress] = useState(0)

  const fetchModelsAndDatasets = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch models
      const modelsResponse = await fetch('/api/v1/intelligence/models')
      const modelsData = await modelsResponse.json()
      
      if (modelsResponse.ok) {
        setModels(modelsData.models || modelsData || [])
      }
      
      // Fetch datasets
      const datasetsResponse = await fetch('/api/v1/intelligence/datasets')
      const datasetsData = await datasetsResponse.json()
      
      if (datasetsResponse.ok) {
        setDatasets(datasetsData.datasets || datasetsData || [])
      }
    } catch (error) {
      console.error('Error fetching models and datasets:', error)
      toast.error('Failed to load models and datasets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchModelsAndDatasets()
    }
    load()
  }, [fetchModelsAndDatasets])

  const handleCreateModel = async () => {
    if (!newModel.name.trim() || !newModel.dataset_id) {
      toast.error('Model name and dataset are required')
      return
    }
    
    try {
      setIsCreating(true)
      const response = await fetch('/api/v1/intelligence/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModel)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Model created successfully')
        setNewModel({ name: '', description: '', type: 'regression', dataset_id: '' })
        fetchModelsAndDatasets()
      } else {
        toast.error(result.error || 'Failed to create model')
      }
    } catch (error) {
      toast.error('Error creating model')
      console.error('Error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleTrainModel = async (modelId: string) => {
    try {
      setIsTraining(true)
      setTrainingStatus('Preparing data...')
      setTrainingProgress(10)
      
      const response = await fetch(`/api/v1/intelligence/models/${modelId}/train`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Model training started successfully')
        
        // Simulate training progress
        const simulateTraining = () => {
          setTrainingProgress(prev => {
            if (prev >= 90) {
              setTrainingStatus('Finalizing model...')
              return 95
            }
            setTrainingStatus(`Training... ${prev + 5}%`)
            return prev + 5
          })
        }
        
        const interval = setInterval(simulateTraining, 2000)
        
        // In a real app, you would poll the API for actual training status
        setTimeout(() => {
          clearInterval(interval)
          setTrainingStatus('Training completed!')
          setTrainingProgress(100)
          fetchModelsAndDatasets()
          setTimeout(() => {
            setTrainingStatus(null)
            setTrainingProgress(0)
          }, 3000)
        }, 20000)
      } else {
        toast.error(result.error || 'Failed to start model training')
        setTrainingStatus(null)
        setTrainingProgress(0)
      }
    } catch (error) {
      toast.error('Error starting model training')
      console.error('Error:', error)
      setTrainingStatus(null)
      setTrainingProgress(0)
    } finally {
      setIsTraining(false)
    }
  }

  const handleDeployModel = async (modelId: string) => {
    try {
      setIsDeploying(true)
      const response = await fetch(`/api/v1/intelligence/models/${modelId}/deploy`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Model deployed successfully')
        fetchModelsAndDatasets()
      } else {
        toast.error(result.error || 'Failed to deploy model')
      }
    } catch (error) {
      toast.error('Error deploying model')
      console.error('Error:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return
    
    try {
      const response = await fetch(`/api/v1/intelligence/models/${modelId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Model deleted successfully')
        fetchModelsAndDatasets()
      } else {
        toast.error(result.error || 'Failed to delete model')
      }
    } catch (error) {
      toast.error('Error deleting model')
      console.error('Error:', error)
    }
  }

  // Exports the model's real record (config, status, metrics, training/
  // deployment metadata) as a JSON file -- there's no model-serving backend
  // to export trained weights/artifacts from, but this data is genuinely
  // real (already loaded in state), so it's an honest "export" rather than
  // a dead button.
  const handleExportModel = (model: Model) => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${model.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${model.id.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const getModelStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>
      case 'training': return <Badge variant="secondary">Training</Badge>
      case 'trained': return <Badge variant="default">Trained</Badge>
      case 'deployed': return <Badge variant="default">Deployed</Badge>
      case 'failed': return <Badge variant="destructive">Failed</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getModelTypeLabel = (type: string) => {
    switch (type) {
      case 'regression': return 'Regression'
      case 'classification': return 'Classification'
      case 'time_series': return 'Time Series'
      case 'clustering': return 'Clustering'
      default: return type
    }
  }

  const getPerformanceMetrics = (model: Model) => {
    if (!model.performance_metrics) return null
    
    switch (model.type) {
      case 'regression':
        return (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground">RMSE</div>
              <div className="font-medium">{model.performance_metrics.rmse?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">MAE</div>
              <div className="font-medium">{model.performance_metrics.mae?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">R²</div>
              <div className="font-medium">{model.performance_metrics.r2?.toFixed(4)}</div>
            </div>
          </div>
        )
      case 'classification':
        return (
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground">Accuracy</div>
              <div className="font-medium">{model.performance_metrics.accuracy?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Precision</div>
              <div className="font-medium">{model.performance_metrics.precision?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Recall</div>
              <div className="font-medium">{model.performance_metrics.recall?.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">F1 Score</div>
              <div className="font-medium">{model.performance_metrics.f1_score?.toFixed(4)}</div>
            </div>
          </div>
        )
      default:
        return (
          <div className="text-sm">
            <div className="text-muted-foreground">Performance metrics available</div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Predictive Modeling</h2>
          <p className="text-sm text-muted-foreground">Create, train, and deploy custom AI models for your business</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Model
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Predictive Model</DialogTitle>
              <DialogDescription>
                Define a new AI model for predictive analytics.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  value={newModel.name}
                  onChange={(e) => setNewModel({...newModel, name: e.target.value})}
                  placeholder="e.g., Customer Churn Prediction, Sales Forecast"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-description">Description</Label>
                <Textarea
                  id="model-description"
                  value={newModel.description}
                  onChange={(e) => setNewModel({...newModel, description: e.target.value})}
                  placeholder="Describe the purpose and use case for this model..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model-type">Model Type</Label>
                  <Select
                    value={newModel.type}
                    onValueChange={(value) => setNewModel({...newModel, type: value as any})}
                  >
                    <SelectTrigger id="model-type">
                      <SelectValue placeholder="Select model type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regression">Regression</SelectItem>
                      <SelectItem value="classification">Classification</SelectItem>
                      <SelectItem value="time_series">Time Series</SelectItem>
                      <SelectItem value="clustering">Clustering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-dataset">Training Dataset</Label>
                  <Select
                    value={newModel.dataset_id}
                    onValueChange={(value) => setNewModel({...newModel, dataset_id: value})}
                  >
                    <SelectTrigger id="model-dataset">
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map(dataset => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.samples} samples, {dataset.features} features)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewModel({
                name: '',
                description: '',
                type: 'regression',
                dataset_id: ''
              })}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateModel} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Model'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {trainingStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Model Training</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{trainingStatus}</span>
              </div>
              <div className="flex items-center gap-4">
                <Progress value={trainingProgress} className="flex-1" />
                <span className="text-sm text-muted-foreground">{trainingProgress}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <Card key={model.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{model.name}</CardTitle>
                      <CardDescription className="text-sm">{model.description}</CardDescription>
                    </div>
                    {getModelStatusBadge(model.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium">{getModelTypeLabel(model.type)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{new Date(model.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {model.training_data && (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Training Data:</span>
                      </div>
                      <div className="pl-6">
                        <div>{model.training_data.samples} samples</div>
                        <div>{model.training_data.features} features</div>
                      </div>
                    </div>
                  )}

                  {model.performance_metrics && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm">Performance Metrics:</span>
                      </div>
                      {getPerformanceMetrics(model)}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {model.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleTrainModel(model.id)}
                        disabled={isTraining}
                      >
                        <Play className="h-4 w-4 mr-1" /> Train
                      </Button>
                    )}
                    {model.status === 'trained' && (
                      <Button
                        size="sm"
                        onClick={() => handleDeployModel(model.id)}
                        disabled={isDeploying}
                      >
                        <Upload className="h-4 w-4 mr-1" /> Deploy
                      </Button>
                    )}
                    {model.status === 'deployed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        title="Prediction is not available yet: this environment has no configured model-serving/inference backend."
                      >
                        <Target className="h-4 w-4 mr-1" /> Predict
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setCurrentModel(model)}>
                      <Info className="h-4 w-4 mr-1" /> Details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="datasets">
          <Card>
            <CardHeader>
              <CardTitle>Training Datasets</CardTitle>
              <CardDescription>Datasets available for model training</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Samples</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasets.map((dataset) => (
                      <TableRow key={dataset.id}>
                        <TableCell className="font-medium">{dataset.name}</TableCell>
                        <TableCell>{dataset.description || '-'}</TableCell>
                        <TableCell>{(dataset.size / 1024 / 1024).toFixed(2)} MB</TableCell>
                        <TableCell>{dataset.features}</TableCell>
                        <TableCell>{dataset.samples}</TableCell>
                        <TableCell>{new Date(dataset.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Deployed Models</CardTitle>
              <CardDescription>Models currently deployed and available for predictions</CardDescription>
            </CardHeader>
            <CardContent>
              {models.filter(model => model.status === 'deployed').length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {models.filter(model => model.status === 'deployed').map((model) => (
                    <Card key={model.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{model.name}</CardTitle>
                        <CardDescription>{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-medium">{getModelTypeLabel(model.type)}</span>
                          </div>
                          {model.deployment_info?.endpoint && (
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Endpoint:</span>
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{model.deployment_info.endpoint}</span>
                            </div>
                          )}
                          {model.deployment_info?.last_deployed && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Last Deployed:</span>
                              <span className="font-medium">{new Date(model.deployment_info.last_deployed).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled
                            title="Prediction is not available yet: this environment has no configured model-serving/inference backend."
                          >
                            <Target className="h-4 w-4 mr-1" /> Predict
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="Live model monitoring is not available yet: this environment has no configured model-serving/inference backend."
                          >
                            <Info className="h-4 w-4 mr-1" /> Monitor
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  No deployed models found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Model Details Dialog */}
      <Dialog open={!!currentModel} onOpenChange={(open) => !open && setCurrentModel(null)}>
        <DialogContent className="max-w-3xl">
          {currentModel && (
            <>
              <DialogHeader>
                <DialogTitle>{currentModel.name}</DialogTitle>
                <DialogDescription>{currentModel.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-medium">Model Information</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Type:</span>
                        <span>{getModelTypeLabel(currentModel.type)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getModelStatusBadge(currentModel.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Created:</span>
                        <span>{new Date(currentModel.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Updated:</span>
                        <span>{new Date(currentModel.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {currentModel.training_data && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Training Data</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Samples:</span>
                          <span>{currentModel.training_data.samples}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Features:</span>
                          <span>{currentModel.training_data.features}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentModel.performance_metrics && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Performance Metrics</h4>
                    {getPerformanceMetrics(currentModel)}
                  </div>
                )}

                {currentModel.status === 'deployed' && currentModel.deployment_info && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Deployment Information</h4>
                    <div className="space-y-1 text-sm">
                      {currentModel.deployment_info.endpoint && (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Endpoint:</span>
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{currentModel.deployment_info.endpoint}</span>
                        </div>
                      )}
                      {currentModel.deployment_info.last_deployed && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Last Deployed:</span>
                          <span>{new Date(currentModel.deployment_info.last_deployed).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentModel.status === 'draft' && (
                      <Button size="sm" onClick={() => handleTrainModel(currentModel.id)}>
                        <Play className="h-4 w-4 mr-1" /> Train Model
                      </Button>
                    )}
                    {currentModel.status === 'trained' && (
                      <Button size="sm" onClick={() => handleDeployModel(currentModel.id)}>
                        <Upload className="h-4 w-4 mr-1" /> Deploy Model
                      </Button>
                    )}
                    {currentModel.status === 'deployed' && (
                      // JUDGMENT CALL: this used to open a dialog with a
                      // "Run Prediction" button that had no onClick (and
                      // whose inputs had no working onChange either) --
                      // wiring it to lib/ai/model-training.ts's predict
                      // endpoint isn't honest here, because that endpoint
                      // now correctly reports that no real model-serving
                      // backend exists in this environment (see the
                      // JUDGMENT CALL comment on makePrediction there). So
                      // rather than build a working form around a call that
                      // always fails, the entry point is disabled with a
                      // clear explanation.
                      <Button
                        size="sm"
                        disabled
                        title="Prediction is not available yet: this environment has no configured model-serving/inference backend."
                      >
                        <Target className="h-4 w-4 mr-1" /> Make Prediction
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleExportModel(currentModel)}>
                      <Save className="h-4 w-4 mr-1" /> Export Model
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}