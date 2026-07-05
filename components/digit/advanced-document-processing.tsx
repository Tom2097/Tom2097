"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock, FileText, Brain, Search, List, Zap, Image, File, Settings, Play, RefreshCw, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface Document {
  id: string
  name: string
  type: string
  status: string
  created_at: string
  metadata?: {
    processing?: {
      options?: Record<string, unknown>
      completed_at?: string
    }
    classification?: {
      primary?: string
      confidence?: number
    }
    entities?: {
      people?: string[]
      organizations?: string[]
      locations?: string[]
    }
    summary?: {
      text?: string
      key_points?: string[]
    }
  }
}

interface ProcessingOptions {
  extractText?: boolean
  extractMetadata?: boolean
  classify?: boolean
  extractEntities?: boolean
  analyzeSentiment?: boolean
  summarize?: boolean
  detectLanguage?: boolean
  translate?: boolean
  targetLanguage?: string
  ocr?: boolean
  enhanceQuality?: boolean
  detectTables?: boolean
  detectForms?: boolean
}

export function AdvancedDocumentProcessing() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<{
    status: string
    progress: number
    error?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchDocuments()
    
    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDocuments()
        if (selectedDocument) {
          checkProcessingStatus(selectedDocument.id)
        }
      }, 5000)
      setRefreshInterval(interval)
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [autoRefresh])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/documents')
      const data = await response.json()
      
      if (response.ok) {
        setDocuments(data)
      } else {
        toast.error(data.error || 'Failed to load documents')
      }
    } catch (error) {
      toast.error('Error loading documents')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkProcessingStatus = async (documentId: string) => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/status`)
      const data = await response.json()
      
      if (response.ok) {
        setProcessingStatus({
          status: data.status,
          progress: data.progress || 0,
          error: data.error
        })
        
        // If processing is complete, refresh documents
        if (data.status === 'processed' || data.status === 'failed') {
          fetchDocuments()
        }
      }
    } catch (error) {
      console.error('Error checking processing status:', error)
    }
  }

  const handleProcessDocument = async (documentId: string) => {
    try {
      setIsProcessing(true)
      setProcessingStatus({
        status: 'processing',
        progress: 0
      })
      
      const response = await fetch(`/api/v1/documents/${documentId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: processingOptions })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Document processing started')
        
        // Start checking status
        const interval = setInterval(() => {
          checkProcessingStatus(documentId)
        }, 2000)
        
        // Store interval for cleanup
        setRefreshInterval(interval)
      } else {
        toast.error(result.error || 'Failed to start document processing')
        setProcessingStatus({
          status: 'failed',
          progress: 0,
          error: result.error || 'Failed to start processing'
        })
      }
    } catch (error) {
      toast.error('Error starting document processing')
      console.error('Error:', error)
      setProcessingStatus({
        status: 'failed',
        progress: 0,
        error: 'Error starting processing'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkProcess = async () => {
    if (!selectedDocument) return
    
    try {
      setIsProcessing(true)
      
      // In a real app, you would call a bulk processing API
      toast.info('Bulk processing would be implemented in a real application')
      
      // For demo purposes, simulate processing
      setProcessingStatus({
        status: 'processing',
        progress: 0
      })
      
      let progress = 0
      const interval = setInterval(() => {
        progress += 5
        setProcessingStatus({
          status: 'processing',
          progress: Math.min(progress, 95)
        })
        
        if (progress >= 95) {
          clearInterval(interval)
          setProcessingStatus({
            status: 'processed',
            progress: 100
          })
          fetchDocuments()
        }
      }, 1000)
      
      setRefreshInterval(interval)
    } catch (error) {
      toast.error('Error starting bulk processing')
      console.error('Error:', error)
      setProcessingStatus({
        status: 'failed',
        progress: 0,
        error: 'Error starting bulk processing'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice': return 'Invoice'
      case 'contract': return 'Contract'
      case 'report': return 'Report'
      case 'email': return 'Email'
      case 'receipt': return 'Receipt'
      case 'form': return 'Form'
      case 'image': return 'Image'
      case 'pdf': return 'PDF'
      case 'spreadsheet': return 'Spreadsheet'
      case 'presentation': return 'Presentation'
      case 'text': return 'Text'
      case 'voice_transcript': return 'Voice Transcript'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded': return <Badge variant="secondary">Uploaded</Badge>
      case 'processing': return <Badge variant="secondary">Processing</Badge>
      case 'processed': return <Badge variant="default">Processed</Badge>
      case 'failed': return <Badge variant="destructive">Failed</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.metadata?.classification?.primary && 
       doc.metadata.classification.primary.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus
    const matchesType = filterType === 'all' || doc.type === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getProcessingOptionsForType = (docType: string) => {
    switch (docType) {
      case 'invoice':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          ocr: true,
          detectTables: true
        }
      case 'contract':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          summarize: true,
          ocr: true
        }
      case 'report':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          summarize: true,
          ocr: true
        }
      case 'email':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          analyzeSentiment: true
        }
      case 'receipt':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          ocr: true
        }
      case 'form':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          extractEntities: true,
          ocr: true,
          detectForms: true
        }
      case 'image':
        return {
          extractText: true,
          ocr: true,
          enhanceQuality: true
        }
      case 'pdf':
        return {
          extractText: true,
          extractMetadata: true,
          classify: true,
          ocr: true
        }
      default:
        return {
          extractText: true,
          classify: true
        }
    }
  }

  const toggleOption = (option: keyof ProcessingOptions) => {
    setProcessingOptions({
      ...processingOptions,
      [option]: !processingOptions[option]
    })
  }

  const renderProcessingResults = () => {
    if (!selectedDocument || !selectedDocument.metadata) return null
    
    return (
      <div className="space-y-6">
        {selectedDocument.metadata.classification && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Document Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Primary Classification:</span>
                  <Badge variant="secondary">
                    {selectedDocument.metadata.classification.primary}
                  </Badge>
                </div>
                {selectedDocument.metadata.classification.confidence && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confidence:</span>
                    <span className="font-medium">
                      {(selectedDocument.metadata.classification.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {selectedDocument.metadata.entities && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Extracted Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="people" className="space-y-4">
                <TabsList>
                  {selectedDocument.metadata.entities.people && selectedDocument.metadata.entities.people.length > 0 && (
                    <TabsTrigger value="people">People</TabsTrigger>
                  )}
                  {selectedDocument.metadata.entities.organizations && selectedDocument.metadata.entities.organizations.length > 0 && (
                    <TabsTrigger value="organizations">Organizations</TabsTrigger>
                  )}
                  {selectedDocument.metadata.entities.locations && selectedDocument.metadata.entities.locations.length > 0 && (
                    <TabsTrigger value="locations">Locations</TabsTrigger>
                  )}
                </TabsList>
                
                {selectedDocument.metadata.entities.people && selectedDocument.metadata.entities.people.length > 0 && (
                  <TabsContent value="people">
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.metadata.entities.people.map((person, index) => (
                        <Badge key={index} variant="secondary">{person}</Badge>
                      ))}
                    </div>
                  </TabsContent>
                )}
                
                {selectedDocument.metadata.entities.organizations && selectedDocument.metadata.entities.organizations.length > 0 && (
                  <TabsContent value="organizations">
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.metadata.entities.organizations.map((org, index) => (
                        <Badge key={index} variant="secondary">{org}</Badge>
                      ))}
                    </div>
                  </TabsContent>
                )}
                
                {selectedDocument.metadata.entities.locations && selectedDocument.metadata.entities.locations.length > 0 && (
                  <TabsContent value="locations">
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.metadata.entities.locations.map((location, index) => (
                        <Badge key={index} variant="secondary">{location}</Badge>
                      ))}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        )}
        
        {selectedDocument.metadata.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                Document Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedDocument.metadata.summary.text && (
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{selectedDocument.metadata.summary.text}</p>
                  </div>
                )}
                {selectedDocument.metadata.summary.key_points && selectedDocument.metadata.summary.key_points.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Points</h4>
                    <ul className="space-y-2 text-sm">
                      {selectedDocument.metadata.summary.key_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-success mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Advanced Document Processing</h2>
          <p className="text-sm text-muted-foreground">Extract insights from documents using OCR, NLP, and AI</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh">Auto-refresh</Label>
          </div>
          <Button variant="outline" onClick={fetchDocuments}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Select a document to process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="uploaded">Uploaded</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="form">Form</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.length > 0 ? (
                        filteredDocuments.map((doc) => (
                          <TableRow
                            key={doc.id}
                            className={selectedDocument?.id === doc.id ? 'bg-muted/50' : ''}
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <TableCell className="font-medium">{doc.name}</TableCell>
                            <TableCell>{getDocumentTypeLabel(doc.type)}</TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell>{new Date(doc.created_at).toLocaleString()}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleProcessDocument(doc.id)
                                }}
                                disabled={doc.status === 'processing' || isProcessing}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {doc.status === 'processing' ? 'Processing...' : 'Process'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            No documents found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="lg:col-span-2 space-y-6">
          {selectedDocument ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedDocument.name}</CardTitle>
                      <CardDescription>
                        {getDocumentTypeLabel(selectedDocument.type)} • {selectedDocument.status}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleProcessDocument(selectedDocument.id)}
                        disabled={selectedDocument.status === 'processing' || isProcessing}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {selectedDocument.status === 'processing' ? 'Processing...' : 'Reprocess'}
                      </Button>
                      <Button onClick={handleBulkProcess} disabled={isProcessing}>
                        <Zap className="h-4 w-4 mr-2" /> Bulk Process
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created:</span>
                      <span className="font-medium">{new Date(selectedDocument.created_at).toLocaleString()}</span>
                    </div>
                    
                    {processingStatus && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="font-medium">{processingStatus.status}</span>
                        </div>
                        <Progress value={processingStatus.progress} className="h-2" />
                        <div className="text-xs text-muted-foreground text-right">
                          {processingStatus.progress}%
                        </div>
                        {processingStatus.error && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            {processingStatus.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Processing Options</CardTitle>
                  <CardDescription>
                    Configure how the document should be processed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extract-text">Extract Text</Label>
                        <Switch
                          id="extract-text"
                          checked={processingOptions.extractText ?? true}
                          onCheckedChange={() => toggleOption('extractText')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extract-metadata">Extract Metadata</Label>
                        <Switch
                          id="extract-metadata"
                          checked={processingOptions.extractMetadata ?? true}
                          onCheckedChange={() => toggleOption('extractMetadata')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="classify">Classify Document</Label>
                        <Switch
                          id="classify"
                          checked={processingOptions.classify ?? true}
                          onCheckedChange={() => toggleOption('classify')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extract-entities">Extract Entities</Label>
                        <Switch
                          id="extract-entities"
                          checked={processingOptions.extractEntities ?? true}
                          onCheckedChange={() => toggleOption('extractEntities')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="analyze-sentiment">Analyze Sentiment</Label>
                        <Switch
                          id="analyze-sentiment"
                          checked={processingOptions.analyzeSentiment ?? false}
                          onCheckedChange={() => toggleOption('analyzeSentiment')}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="summarize">Summarize Document</Label>
                        <Switch
                          id="summarize"
                          checked={processingOptions.summarize ?? false}
                          onCheckedChange={() => toggleOption('summarize')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ocr">Optical Character Recognition (OCR)</Label>
                        <Switch
                          id="ocr"
                          checked={processingOptions.ocr ?? false}
                          onCheckedChange={() => toggleOption('ocr')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="detect-tables">Detect Tables</Label>
                        <Switch
                          id="detect-tables"
                          checked={processingOptions.detectTables ?? false}
                          onCheckedChange={() => toggleOption('detectTables')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="detect-forms">Detect Forms</Label>
                        <Switch
                          id="detect-forms"
                          checked={processingOptions.detectForms ?? false}
                          onCheckedChange={() => toggleOption('detectForms')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="translate">Translate Document</Label>
                        <Switch
                          id="translate"
                          checked={processingOptions.translate ?? false}
                          onCheckedChange={() => toggleOption('translate')}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {processingOptions.translate && (
                    <div className="mt-4">
                      <Label htmlFor="target-language">Target Language</Label>
                      <Select
                        value={processingOptions.targetLanguage || 'es'}
                        onValueChange={(value) => setProcessingOptions({
                          ...processingOptions,
                          targetLanguage: value
                        })}
                      >
                        <SelectTrigger id="target-language" className="mt-1">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={() => {
                        const defaultOptions = getProcessingOptionsForType(selectedDocument.type)
                        setProcessingOptions(defaultOptions)
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Reset to Defaults
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {renderProcessingResults()}
            </>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a document to process</h3>
                <p className="text-sm text-muted-foreground">Choose a document from the list to view processing options and results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}