'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Brain, BarChart3, Sparkles, Loader2, AlertCircle, CheckCircle, XCircle, Target, RefreshCw, Lightbulb } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'text/csv',
  'application/json',
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
]

// File type to readable name
const FILE_TYPE_NAMES: Record<string, string> = {
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'text/plain': 'Text',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',
}

// Analysis types
const ANALYSIS_TYPES = [
  { value: 'text_extraction', label: 'Text Extraction' },
  { value: 'data_analysis', label: 'Data Analysis' },
  { value: 'document_summary', label: 'Document Summary' },
  { value: 'entity_extraction', label: 'Entity Extraction' },
  { value: 'sentiment_analysis', label: 'Sentiment Analysis' },
  { value: 'custom_prompt', label: 'Custom Prompt' },
]

// NLP analysis types
const NLP_ANALYSIS_TYPES = [
  { value: 'sentiment', label: 'Sentiment Analysis' },
  { value: 'entities', label: 'Entity Recognition' },
  { value: 'classification', label: 'Text Classification' },
  { value: 'keywords', label: 'Keyword Extraction' },
  { value: 'summary', label: 'Text Summarization' },
  { value: 'intent', label: 'Intent Detection' },
  { value: 'toxicity', label: 'Toxicity Detection' },
  { value: 'language', label: 'Language Detection' },
  { value: 'comprehensive', label: 'Comprehensive Analysis' },
]

export default function AIAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'files' | 'nlp'>('files')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [files, setFiles] = useState<Array<{
    id: string
    name: string
    type: string
    size: number
    status: 'uploading' | 'processing' | 'completed' | 'failed'
    result?: any
    error?: string
  }>>([])
  const [nlpText, setNlpText] = useState('')
  const [nlpAnalysisType, setNlpAnalysisType] = useState('comprehensive')
  const [nlpResult, setNlpResult] = useState<any>(null)
  const [isAnalyzingNLP, setIsAnalyzingNLP] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!SUPPORTED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(csv|json|txt|pdf|docx|xlsx|xls)$/i)) {
      toast.error('Unsupported file type. Please upload CSV, JSON, TXT, PDF, DOCX, XLSX, or XLS files.')
      return
    }

    const fileId = crypto.randomUUID()
    const newFile = {
      id: fileId,
      name: file.name,
      type: FILE_TYPE_NAMES[file.type] || file.type.split('/').pop() || 'File',
      size: file.size,
      status: 'uploading' as const,
    }

    setFiles(prev => [...prev, newFile])
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Read file content
      const content = await file.text()
      
      // Create FormData for upload
      const formData = new FormData()
      formData.append('file', new Blob([content], { type: file.type }), file.name)
      formData.append('analysisType', 'text_extraction')

      // Upload to server
      const response = await fetch('/api/v1/analytics/files', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      
      // Update file status
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'completed', result } : f
      ))
      toast.success(`File "${file.name}" uploaded and analyzed successfully!`)
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'failed', error: error instanceof Error ? error.message : 'Upload failed' } : f
      ))
      toast.error(`Failed to upload "${file.name}"`)
    } finally {
      setIsUploading(false)
      setUploadProgress(100)
    }
  }, [])

  // Handle NLP analysis
  const handleNLPAnalysis = useCallback(async () => {
    if (!nlpText.trim()) {
      toast.error('Please enter some text to analyze')
      return
    }

    setIsAnalyzingNLP(true)
    setNlpResult(null)

    try {
      const response = await fetch('/api/v1/analytics/nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nlpText,
          analysisType: nlpAnalysisType,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      setNlpResult(result)
      toast.success('NLP analysis completed!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'NLP analysis failed')
    } finally {
      setIsAnalyzingNLP(false)
    }
  }, [nlpText, nlpAnalysisType])

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFileUpload])

  // Handle drag and drop
  const [isDragging, setIsDragging] = useState(false)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading</Badge>
      case 'processing':
        return <Badge variant="default" className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Processing</Badge>
      case 'completed':
        return <Badge variant="default" className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> Completed</Badge>
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Analytics</h1>
            <p className="text-muted-foreground">Intelligent document and text analysis powered by AI</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Brain className="h-4 w-4 text-primary" />
              AI-Powered
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'files' | 'nlp')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Analysis
            </TabsTrigger>
            <TabsTrigger value="nlp" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Text Analysis
            </TabsTrigger>
          </TabsList>

          {/* File Analysis Tab */}
          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents for AI Analysis</CardTitle>
                <CardDescription>
                  Upload CSV, JSON, TXT, PDF, DOCX, XLSX, or XLS files for intelligent analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* File Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging ? 'border-primary bg-muted/50' : 'border-muted'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".csv,.json,.txt,.pdf,.docx,.xlsx,.xls"
                  />
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Drop files here or click to browse</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supported: CSV, JSON, TXT, PDF, DOCX, XLSX, XLS
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Select File
                  </Button>
                </div>

                {/* Progress Bar */}
                {isUploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {/* Uploaded Files List */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h4 className="text-sm font-medium">Uploaded Files ({files.length})</h4>
                    <div className="space-y-3">
                      {files.map((file) => (
                        <Card key={file.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {file.type} • {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {file.result && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Show result
                                    toast.info('Analysis result available', {
                                      description: JSON.stringify(file.result, null, 2),
                                    })
                                  }}
                                >
                                  View Result
                                </Button>
                              )}
                              {getStatusBadge(file.status)}
                            </div>
                          </div>
                          {file.error && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{file.error}</AlertDescription>
                            </Alert>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis Types Info */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Available Analysis Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ANALYSIS_TYPES.map((type) => (
                        <div key={type.value} className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">{type.label}</h4>
                          <p className="text-sm text-muted-foreground">
                            {type.value === 'text_extraction' && 'Extract all readable text from documents'}
                            {type.value === 'data_analysis' && 'Analyze structured data and provide insights'}
                            {type.value === 'document_summary' && 'Generate comprehensive document summaries'}
                            {type.value === 'entity_extraction' && 'Extract entities (people, organizations, locations, etc.)'}
                            {type.value === 'sentiment_analysis' && 'Analyze sentiment and emotional tone'}
                            {type.value === 'custom_prompt' && 'Use custom prompts for specific analysis needs'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NLP Text Analysis Tab */}
          <TabsContent value="nlp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Natural Language Processing</CardTitle>
                <CardDescription>
                  Analyze text content using advanced NLP techniques
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Text Input */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Text to Analyze</label>
                      <Textarea
                        placeholder="Enter or paste your text here..."
                        value={nlpText}
                        onChange={(e) => setNlpText(e.target.value)}
                        rows={10}
                        className="min-h-[200px]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Analysis Type</label>
                      <Select value={nlpAnalysisType} onValueChange={setNlpAnalysisType}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select analysis type" />
                        </SelectTrigger>
                        <SelectContent>
                          {NLP_ANALYSIS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleNLPAnalysis}
                      disabled={isAnalyzingNLP || !nlpText.trim()}
                      className="w-full"
                    >
                      {isAnalyzingNLP ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Analyze Text
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Results */}
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg min-h-[200px]">
                      <h4 className="font-medium mb-4">Analysis Results</h4>
                      {nlpResult ? (
                        <div className="space-y-4">
                          <Alert className="bg-green-50 border-green-200 text-green-800">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription>Analysis completed successfully!</AlertDescription>
                          </Alert>
                          
                          <pre className="text-sm bg-background p-4 rounded overflow-x-auto">
                            {JSON.stringify(nlpResult, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Enter text and click "Analyze" to see results</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* NLP Features Info */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>NLP Capabilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: <Brain className="h-5 w-5" />, label: 'Sentiment', desc: 'Positive/Negative/Neutral' },
                        { icon: <Target className="h-5 w-5" />, label: 'Entities', desc: 'People, Orgs, Locations' },
                        { icon: <BarChart3 className="h-5 w-5" />, label: 'Classification', desc: '14 categories' },
                        { icon: <Lightbulb className="h-5 w-5" />, label: 'Intent', desc: 'Question, Command, etc.' },
                        { icon: <AlertCircle className="h-5 w-5" />, label: 'Toxicity', desc: '6 categories' },
                        { icon: <FileText className="h-5 w-5" />, label: 'Keywords', desc: 'With relevance scoring' },
                        { icon: <Upload className="h-5 w-5" />, label: 'Language', desc: 'ISO code detection' },
                        { icon: <Sparkles className="h-5 w-5" />, label: 'Comprehensive', desc: 'All features combined' },
                      ].map((feature, index) => (
                        <div key={index} className="text-center p-3 border rounded-lg">
                          <div className="text-primary mb-2">{feature.icon}</div>
                          <h4 className="font-medium text-sm">{feature.label}</h4>
                          <p className="text-xs text-muted-foreground">{feature.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
