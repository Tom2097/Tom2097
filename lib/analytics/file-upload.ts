import { generateText, streamText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"
import { randomUUID } from "crypto"

/**
 * Module #7.6: File Upload and Document Analysis.
 * 
 * Enables users to upload files (CSV, JSON, Excel, Text) for AI-powered
 * analysis and data extraction. Supports document processing, text
 * extraction, and structured data analysis.
 */

// Supported file types
export type FileType = "csv" | "json" | "txt" | "text" | "pdf" | "docx" | "xlsx" | "xls"

// File analysis types
export type AnalysisType = 
  | "text_extraction"
  | "data_analysis"
  | "document_summary"
  | "entity_extraction"
  | "sentiment_analysis"
  | "custom_prompt"

// Uploaded file metadata
export interface UploadedFile {
  id: string
  organizationId: string
  userId: string
  filename: string
  originalFilename: string
  fileType: FileType
  fileSize: number
  mimeType: string
  storagePath: string
  blobUrl?: string
  uploadedAt: string
  status: "pending" | "processing" | "completed" | "failed"
  analysisType?: AnalysisType
  analysisResult?: any
  errorMessage?: string
}

// File analysis options
export interface FileAnalysisOptions {
  /** Type of analysis to perform */
  analysisType: AnalysisType
  /** Custom prompt for analysis (for custom_prompt type) */
  customPrompt?: string
  /** Specific questions to answer about the document */
  questions?: string[]
  /** Extract specific fields */
  extractFields?: string[]
  /** Output format */
  outputFormat?: "json" | "markdown" | "text"
  /** Include raw extracted text */
  includeRawText?: boolean
  /** Maximum tokens for AI analysis */
  maxTokens?: number
  /** Temperature for AI creativity (0-1) */
  temperature?: number
}

// File analysis result
export interface FileAnalysisResult {
  fileId: string
  filename: string
  fileType: FileType
  analysisType: AnalysisType
  processedAt: string
  processingTime: number
  
  // For text extraction
  extractedText?: string
  
  // For data analysis
  extractedData?: any[]
  dataSummary?: {
    rows: number
    columns: number
    headers: string[]
    dataTypes: Record<string, string>
  }
  
  // For document summary
  summary?: string
  keyPoints?: string[]
  
  // For entity extraction
  entities?: {
    people: string[]
    organizations: string[]
    locations: string[]
    dates: string[]
    amounts: string[]
    custom: Record<string, any>
  }
  
  // For sentiment analysis
  sentiment?: {
    overall: "positive" | "negative" | "neutral" | "mixed"
    score: number // -1 to 1
    confidence: number
    sentences: Array<{
      text: string
      sentiment: "positive" | "negative" | "neutral"
      score: number
    }>
  }
  
  // For custom analysis
  customResult?: any
  
  // Metadata
  modelUsed: string
  tokensUsed: number
  
  // Questions and answers
  qaPairs?: Array<{
    question: string
    answer: string
    confidence: number
  }>
}

const DEFAULT_ANALYSIS_OPTIONS: Required<Omit<FileAnalysisOptions, "analysisType">> = {
  customPrompt: "",
  questions: [],
  extractFields: [],
  outputFormat: "json",
  includeRawText: false,
  maxTokens: 4000,
  temperature: 0.3,
}

/**
 * Parse CSV text into structured data
 */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n')
  
  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }
  
  // Parse header row
  const headers = lines[0].split(',').map(h => h.trim())
  
  // Parse data rows
  const rows: Record<string, string>[] = []
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    
    const values = lines[i].split(',')
    const row: Record<string, string> = {}
    
    for (let j = 0; j < Math.min(headers.length, values.length); j++) {
      row[headers[j]] = values[j].trim()
    }
    
    rows.push(row)
  }
  
  return { headers, rows }
}

/**
 * Parse JSON text
 */
function parseJSON(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Detect file type from filename and content
 */
function detectFileType(filename: string, contentType: string, content: string): FileType {
  const ext = filename.toLowerCase().split('.').pop() || ""
  
  const typeMap: Record<string, FileType> = {
    csv: "csv",
    json: "json",
    txt: "txt",
    text: "text",
    pdf: "pdf",
    docx: "docx",
    xlsx: "xlsx",
    xls: "xls",
  }
  
  if (typeMap[ext]) return typeMap[ext]
  
  // Check content type
  if (contentType.includes("csv")) return "csv"
  if (contentType.includes("json")) return "json"
  if (contentType.includes("text")) return "txt"
  if (contentType.includes("pdf")) return "pdf"
  if (contentType.includes("word")) return "docx"
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "xlsx"
  
  // Check content
  if (content.startsWith("{") || content.startsWith("[")) return "json"
  if (content.includes(",") && content.split('\n').length > 1) return "csv"
  
  return "txt"
}

/**
 * Generate a system prompt for document analysis
 */
function buildDocumentAnalysisPrompt(
  fileType: FileType,
  analysisType: AnalysisType,
  options: FileAnalysisOptions
): string {
  const prompts: Record<AnalysisType, string> = {
    text_extraction: `Extract all readable text from this ${fileType} document. 
Return ONLY the raw text content without any formatting, commentary, or markdown. 
Be accurate and preserve the original content structure as much as possible.`,

    data_analysis: `Analyze the data in this ${fileType} file. 
Identify the structure, key fields, and provide insights about the data.
Return a JSON object with: { headers: string[], data: any[], summary: { rows: number, columns: number, insights: string[] } }`,

    document_summary: `Provide a comprehensive summary of this ${fileType} document. 
Identify the main topics, key points, and important information.
Return a JSON object with: { title: string, summary: string, keyPoints: string[], wordCount: number }`,

    entity_extraction: `Extract all entities from this ${fileType} document. 
Return a JSON object with: { people: string[], organizations: string[], locations: string[], dates: string[], amounts: string[] }`,

    sentiment_analysis: `Analyze the sentiment of this ${fileType} document. 
Return a JSON object with: { overall: string, score: number, confidence: number, sentences: [{text: string, sentiment: string, score: number}] }`,

    custom_prompt: options.customPrompt || "Analyze this document and provide insights.",
  }

  return `${BASE_SYSTEM_PROMPT}

You are an expert document analyst. ${prompts[analysisType]}`
}

/**
 * Extract text from file content based on file type
 */
async function extractTextFromFile(
  content: string,
  fileType: FileType
): Promise<string> {
  
  switch (fileType) {
    case "csv":
    case "json":
    case "txt":
    case "text":
      return content
    
    case "pdf":
    case "docx":
    case "xlsx":
    case "xls":
      // For binary formats, return a message that we need to parse them differently
      return `[Document of type ${fileType}] - Text extraction for this format requires additional processing. ` +
             `Please provide the extracted text or use CSV/JSON/TXT formats for direct analysis.`
    
    default:
      return content
  }
}

/**
 * Analyze a file using AI
 */
export async function analyzeFile(
  organizationId: string,
  userId: string,
  file: {
    filename: string
    content: string
    contentType: string
    size: number
  },
  options: FileAnalysisOptions
): Promise<FileAnalysisResult> {
  const startTime = Date.now()
  
  // Detect file type
  const fileType = detectFileType(file.filename, file.contentType, file.content)
  
  // Generate unique file ID
  const fileId = randomUUID()
  
  // Extract text from file
  const text = await extractTextFromFile(file.content, fileType)
  
  // Build analysis prompt
  const systemPrompt = buildDocumentAnalysisPrompt(fileType, options.analysisType, options)
  
  // Prepare user prompt with additional context
  let userPrompt = `Document filename: ${file.filename}\n`
  userPrompt += `Document type: ${fileType}\n`
  userPrompt += `Document size: ${file.size} bytes\n\n`
  
  if (options.questions && options.questions.length > 0) {
    userPrompt += `Answer the following questions about this document:\n`
    userPrompt += options.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    userPrompt += '\n\n'
  }
  
  if (options.extractFields && options.extractFields.length > 0) {
    userPrompt += `Extract the following fields: ${options.extractFields.join(', ')}\n\n`
  }
  
  userPrompt += `---\n\n`
  userPrompt += text
  
  // Analyze using AI
  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  
  const processingTime = Date.now() - startTime
  
  // Parse the result based on analysis type
  const analysisResult: FileAnalysisResult = {
    fileId,
    filename: file.filename,
    fileType,
    analysisType: options.analysisType,
    processedAt: new Date().toISOString(),
    processingTime,
    modelUsed: DEFAULT_CHAT_MODEL,
    tokensUsed: result.tokens || 0,
  }
  
  try {
    // Try to parse as JSON first
    if (result.text.trim().startsWith('{') || result.text.trim().startsWith('[')) {
      const parsed = JSON.parse(result.text)
      
      switch (options.analysisType) {
        case "text_extraction":
          analysisResult.extractedText = typeof parsed === 'string' ? parsed : result.text
          break
          
        case "data_analysis":
          if (parsed.headers && parsed.data) {
            analysisResult.extractedData = parsed.data
            analysisResult.dataSummary = {
              rows: parsed.data.length,
              columns: parsed.headers.length,
              headers: parsed.headers,
              dataTypes: {}, // Would need to infer types
            }
          }
          break
          
        case "document_summary":
          if (parsed.summary) {
            analysisResult.summary = parsed.summary
            analysisResult.keyPoints = parsed.keyPoints || []
          } else {
            analysisResult.summary = result.text
          }
          break
          
        case "entity_extraction":
          analysisResult.entities = parsed
          break
          
        case "sentiment_analysis":
          analysisResult.sentiment = parsed
          break
          
        case "custom_prompt":
          analysisResult.customResult = parsed
          break
      }
    } else {
      // For non-JSON responses
      switch (options.analysisType) {
        case "text_extraction":
        case "document_summary":
          analysisResult.extractedText = result.text
          break
        case "custom_prompt":
          analysisResult.customResult = result.text
          break
        default:
          analysisResult.extractedText = result.text
      }
    }
    
    // Handle questions if provided
    if (options.questions && options.questions.length > 0 && !analysisResult.qaPairs) {
      // Try to extract Q&A pairs from the response
      const qaPairs: { question: string; answer: string; confidence: number }[] = []
      
      for (const question of options.questions) {
        // Look for question in response
        const questionIndex = result.text.toLowerCase().indexOf(question.toLowerCase())
        if (questionIndex !== -1) {
          // Extract text after the question
          const answerStart = questionIndex + question.length
          const answerEnd = result.text.indexOf('\n\n', answerStart)
          const answer = result.text.slice(answerStart, answerEnd !== -1 ? answerEnd : undefined).trim()
          
          qaPairs.push({
            question,
            answer,
            confidence: 80, // Placeholder
          })
        }
      }
      
      if (qaPairs.length > 0) {
        analysisResult.qaPairs = qaPairs
      }
    }
    
    if (options.includeRawText) {
      analysisResult.extractedText = text
    }
    
  } catch (error) {
    console.error("[File Analysis] Error parsing result:", error)
    // Fallback: store raw result
    analysisResult.extractedText = result.text
  }
  
  return analysisResult
}

/**
 * Stream file analysis for large documents
 */
export async function* streamFileAnalysis(
  organizationId: string,
  userId: string,
  file: {
    filename: string
    content: string
    contentType: string
    size: number
  },
  options: FileAnalysisOptions
): AsyncGenerator<{ type: string; data: any }> {
  const fileType = detectFileType(file.filename, file.contentType, file.content)
  const text = await extractTextFromFile(file.content, fileType)
  
  // Yield file metadata
  yield { type: "metadata", data: { filename: file.filename, fileType, size: file.size } }
  
  // Yield extraction start
  yield { type: "status", data: { message: "Extracting text...", progress: 10 } }
  
  // For large files, chunk the content
  const chunkSize = 4000 // Token limit per chunk
  const chunks = []
  
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  
  // Stream analysis for each chunk
  const systemPrompt = buildDocumentAnalysisPrompt(fileType, options.analysisType, options)
  
  for (let i = 0; i < chunks.length; i++) {
    const progress = 20 + Math.floor((i / chunks.length) * 60)
    yield { type: "status", data: { message: `Analyzing chunk ${i + 1}/${chunks.length}...`, progress } }
    
    const userPrompt = `Document: ${file.filename} (chunk ${i + 1}/${chunks.length})\n\n${chunks[i]}`
    
    const resultStream = await streamText({
      model: DEFAULT_CHAT_MODEL,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: Math.min(options.maxTokens, 2000),
    })
    
    let chunkResult = ""
    for await (const chunk of resultStream.textStream) {
      chunkResult += chunk
      yield { type: "chunk_result", data: { chunk: i, text: chunk } }
    }
    
    yield { type: "chunk_complete", data: { chunk: i, result: chunkResult } }
  }
  
  yield { type: "status", data: { message: "Compiling final results...", progress: 90 } }
  yield { type: "complete", data: { message: "Analysis complete!" } }
}

/**
 * Store uploaded file metadata in database
 */
export async function storeFileMetadata(
  organizationId: string,
  userId: string,
  file: UploadedFile
): Promise<UploadedFile> {
  try {
    const db = createServiceClient()
    
    const { data, error } = await db
      .from("uploaded_files")
      .upsert([{
        id: file.id,
        organization_id: organizationId,
        user_id: userId,
        filename: file.filename,
        original_filename: file.originalFilename,
        file_type: file.fileType,
        file_size: file.fileSize,
        mime_type: file.mimeType,
        storage_path: file.storagePath,
        blob_url: file.blobUrl,
        uploaded_at: file.uploadedAt,
        status: file.status,
        analysis_type: file.analysisType,
        analysis_result: file.analysisResult,
        error_message: file.errorMessage,
      }])
      .select()
      .single()
    
    if (error) {
      console.error("[File Upload] Error storing file metadata:", error.message)
      return file
    }
    
    return { ...file, ...(data as any) }
    
  } catch (error) {
    console.error("[File Upload] Error storing file metadata:", error)
    return file
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadToBlobStorage(
  organizationId: string,
  file: {
    content: string | ArrayBuffer
    contentType: string
    filename: string
  }
): Promise<{ url: string; path: string } | null> {
  try {
    const db = createServiceClient()
    const path = `analytics/${organizationId}/uploads/${randomUUID()}-${file.filename}`
    
    // Convert content to Blob or Buffer for Supabase Storage
    let content: Blob | Buffer
    if (typeof file.content === 'string') {
      content = Buffer.from(file.content, 'utf-8')
    } else if (file.content instanceof ArrayBuffer) {
      content = Buffer.from(file.content)
    } else {
      content = file.content as Buffer
    }
    
    const { data, error } = await db.storage
      .from('analytics')
      .upload(path, content, {
        contentType: file.contentType,
        upsert: true,
      })
    
    if (error || !data) {
      console.error("[File Upload] Error uploading to Supabase Storage:", error?.message)
      return null
    }
    
    // Get the public URL
    const { data: urlData } = db.storage
      .from('analytics')
      .getPublicUrl(path)
    
    return {
      url: urlData.publicUrl,
      path,
    }
    
  } catch (error) {
    console.error("[File Upload] Error uploading to storage:", error)
    return null
  }
}

/**
 * Process uploaded file
 */
export async function processUploadedFile(
  organizationId: string,
  userId: string,
  file: {
    id: string
    filename: string
    originalFilename: string
    content: string
    contentType: string
    size: number
  },
  analysisType: AnalysisType,
  options: Partial<FileAnalysisOptions> = {}
): Promise<UploadedFile> {
  const startTime = Date.now()
  
  const fileType = detectFileType(file.filename, file.contentType, file.content)
  
  const uploadedFile: UploadedFile = {
    id: file.id,
    organizationId,
    userId,
    filename: file.filename,
    originalFilename: file.originalFilename,
    fileType,
    fileSize: file.size,
    mimeType: file.contentType,
    storagePath: file.filename,
    uploadedAt: new Date().toISOString(),
    status: "processing",
    analysisType,
  }
  
  try {
    // Store file metadata first
    await storeFileMetadata(organizationId, userId, uploadedFile)
    
    // Analyze the file
    const analysisResult = await analyzeFile(
      organizationId,
      userId,
      {
        filename: file.originalFilename,
        content: file.content,
        contentType: file.contentType,
        size: file.size,
      },
      { analysisType, ...options }
    )
    
    // Update file with analysis results
    uploadedFile.status = "completed"
    uploadedFile.analysisResult = analysisResult
    uploadedFile.blobUrl = analysisResult.extractedText
    
    await storeFileMetadata(organizationId, userId, uploadedFile)
    
    return uploadedFile
    
  } catch (error) {
    console.error("[File Upload] Error processing file:", error)
    
    uploadedFile.status = "failed"
    uploadedFile.errorMessage = error instanceof Error ? error.message : "Processing failed"
    
    await storeFileMetadata(organizationId, userId, uploadedFile)
    
    return uploadedFile
  }
}

/**
 * Get list of uploaded files for an organization
 */
export async function getUploadedFiles(
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    status?: string
    analysisType?: AnalysisType
    userId?: string
  } = {}
): Promise<UploadedFile[]> {
  try {
    const db = createServiceClient()
    
    let query = db
      .from("uploaded_files")
      .select("*")
      .eq("organization_id", organizationId)
      .order("uploaded_at", { ascending: false })
    
    if (options.limit) query = query.limit(options.limit)
    if (options.offset) query = query.offset(options.offset)
    if (options.status) query = query.eq("status", options.status)
    if (options.analysisType) query = query.eq("analysis_type", options.analysisType)
    if (options.userId) query = query.eq("user_id", options.userId)
    
    const { data, error } = await query
    
    if (error) {
      console.error("[File Upload] Error getting uploaded files:", error.message)
      return []
    }
    
    return (data ?? []) as UploadedFile[]
    
  } catch (error) {
    console.error("[File Upload] Error getting uploaded files:", error)
    return []
  }
}

/**
 * Get a specific uploaded file
 */
export async function getUploadedFile(
  organizationId: string,
  fileId: string
): Promise<UploadedFile | null> {
  try {
    const db = createServiceClient()
    
    const { data, error } = await db
      .from("uploaded_files")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", fileId)
      .single()
    
    if (error || !data) {
      return null
    }
    
    return data as UploadedFile
    
  } catch (error) {
    console.error("[File Upload] Error getting uploaded file:", error)
    return null
  }
}

/**
 * Delete an uploaded file
 */
export async function deleteUploadedFile(
  organizationId: string,
  fileId: string
): Promise<boolean> {
  try {
    const db = createServiceClient()
    
    const { error } = await db
      .from("uploaded_files")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", fileId)
    
    if (error) {
      console.error("[File Upload] Error deleting file:", error.message)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error("[File Upload] Error deleting file:", error)
    return false
  }
}

export {
  randomUUID,
}
