
import { createServiceClient } from '@/lib/supabase/service'
import { logAuthEvent } from '@/lib/auth/audit'
import { trackUsage } from '@/lib/billing/usage-tracking'
import { dispatchDocumentEvent } from '@/lib/documents/events'
import { classifyText, extractEntities, analyzeSentiment, generateSummary } from '@/lib/analytics/nlp'
import { runOcr } from '@/lib/ocr/engine'

// Document processing types
export type DocumentType =
  | 'invoice'
  | 'contract'
  | 'report'
  | 'email'
  | 'receipt'
  | 'form'
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'voice_transcript'
  | 'other'

// Document processing options
export interface DocumentProcessingOptions {
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
  generateThumbnails?: boolean
}

// Default processing options by document type
export const DEFAULT_PROCESSING_OPTIONS: Record<DocumentType, DocumentProcessingOptions> = {
  invoice: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    ocr: true,
    detectTables: true
  },
  contract: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    summarize: true,
    ocr: true
  },
  report: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    summarize: true,
    ocr: true
  },
  email: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    analyzeSentiment: true
  },
  receipt: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    ocr: true
  },
  form: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    extractEntities: true,
    ocr: true,
    detectForms: true
  },
  image: {
    extractText: true,
    ocr: true,
    enhanceQuality: true,
    generateThumbnails: true
  },
  pdf: {
    extractText: true,
    extractMetadata: true,
    classify: true,
    ocr: true
  },
  spreadsheet: {
    extractText: true,
    extractMetadata: true,
    detectTables: true
  },
  presentation: {
    extractText: true,
    extractMetadata: true,
    classify: true
  },
  text: {
    extractText: true,
    classify: true,
    extractEntities: true,
    analyzeSentiment: true
  },
  voice_transcript: {
    extractText: true,
    classify: true,
    extractEntities: true,
    summarize: true
  },
  other: {
    extractText: true,
    classify: true
  }
}

// Process a document with advanced capabilities
export async function processDocument(
  organizationId: string,
  userId: string | null,
  documentId: string,
  options?: DocumentProcessingOptions
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', organizationId)
      .single()
    
    if (docError || !document) {
      console.error('[DocumentProcessing] Document not found:', docError)
      return false
    }
    
    // Determine document type and processing options
    const docType = document.type as DocumentType || 'other'
    const processingOptions = options || DEFAULT_PROCESSING_OPTIONS[docType]
    
    // Log processing start
    await logAuthEvent({
      action: 'document.processing_started',
      organizationId,
      userId,
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        documentType: docType,
        processingOptions
      }
    })
    
    // Track usage
    await trackUsage(organizationId, userId, 'document_processing', 1, {
      documentType: docType,
      processingOptions
    })
    
    // Update document status
    await supabase
      .from('documents')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', documentId)
    
    // Process the document based on its type and options
    const processingResults = await processDocumentContent(
      document.content,
      docType,
      processingOptions
    )
    
    // Update document with processing results
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'processed',
        content: processingResults.content || document.content,
        extracted_text: processingResults.extractedText,
        metadata: {
          ...document.metadata,
          ...processingResults.metadata,
          processing: {
            options: processingOptions,
            completed_at: new Date().toISOString()
          }
        },
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', documentId)
    
    if (updateError) {
      console.error('[DocumentProcessing] Error updating document:', updateError)
      throw updateError
    }
    
    // Dispatch document processed event
    await dispatchDocumentEvent({
      type: 'document.processed',
      organization_id: organizationId,
      document_id: documentId,
      actor_id: userId,
      metadata: {
        documentType: docType,
        processingResults
      }
    })
    
    // Log processing completion
    await logAuthEvent({
      action: 'document.processing_completed',
      organizationId,
      userId,
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        documentType: docType,
        processingResults
      }
    })
    
    return true
  } catch (err) {
    console.error('[DocumentProcessing] Error processing document:', err)
    
    // Update document status to failed
    try {
      const supabase = await createServiceClient()
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_error: err instanceof Error ? err.message : String(err),
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', documentId)
      
      // Log processing failure
      await logAuthEvent({
        action: 'document.processing_failed',
        organizationId,
        userId,
        resourceType: 'document',
        resourceId: documentId,
        metadata: {
          error: err instanceof Error ? err.message : String(err)
        }
      })
    } catch (updateErr) {
      console.error('[DocumentProcessing] Error updating failed document status:', updateErr)
    }
    
    return false
  }
}

// Process document content based on type and options
async function processDocumentContent(
  content: string,
  docType: DocumentType,
  options: DocumentProcessingOptions
) {
  const results: {
    content?: string
    extractedText?: string
    metadata?: Record<string, unknown>
  } = {}
  
  // Step 1: Extract text from document (OCR if needed)
  if (options.extractText || options.ocr) {
    try {
      if (options.ocr) {
        // Run OCR on the document content (assuming it's an image or PDF)
        // OCR is not implemented for direct content processing in this mock implementation
        // In a real implementation, you would need to save the content to storage first
        const ocrResult = {
          text: content,
          confidence: 0.95,
          language: 'en',
          processingTime: 100
        }
        results.extractedText = ocrResult.text
        results.metadata = {
          ...results.metadata,
          ocr: {
            confidence: ocrResult.confidence,
            language: ocrResult.language,
            processing_time: ocrResult.processingTime
          }
        }
        
        // Track OCR usage
        await trackUsage(
          '', // organizationId will be set by the calling function
          null, // userId
          'ocr_processing',
          1,
          { documentType: docType }
        )
      } else {
        // Use the existing content as extracted text
        results.extractedText = content
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error extracting text:', err)
      results.metadata = {
        ...results.metadata,
        text_extraction: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 2: Extract metadata
  if (options.extractMetadata) {
    try {
      // Extract basic metadata from the document
      const metadata = extractBasicMetadata(results.extractedText || content)
      results.metadata = {
        ...results.metadata,
        ...metadata
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error extracting metadata:', err)
      results.metadata = {
        ...results.metadata,
        metadata_extraction: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 3: Classify the document
  if (options.classify && results.extractedText) {
    try {
      const classification = await classifyText(results.extractedText)
      results.metadata = {
        ...results.metadata,
        classification: {
          primary: classification.primary,
          secondary: classification.secondary,
          confidence: classification.confidence
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error classifying document:', err)
      results.metadata = {
        ...results.metadata,
        classification: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 4: Extract entities
  if (options.extractEntities && results.extractedText) {
    try {
      const entities = await extractEntities(results.extractedText)
      results.metadata = {
        ...results.metadata,
        entities: {
          people: entities.entities.filter(e => e.type === 'person'),
          organizations: entities.entities.filter(e => e.type === 'organization'),
          locations: entities.entities.filter(e => e.type === 'location'),
          dates: entities.entities.filter(e => e.type === 'date'),
          amounts: entities.entities.filter(e => e.type === 'amount'),
          custom: entities.entities.filter(e => e.type === 'custom')
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error extracting entities:', err)
      results.metadata = {
        ...results.metadata,
        entity_extraction: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 5: Analyze sentiment
  if (options.analyzeSentiment && results.extractedText) {
    try {
      const sentiment = await analyzeSentiment(results.extractedText)
      results.metadata = {
        ...results.metadata,
        sentiment: {
          score: sentiment.score,

          label: sentiment.overall
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error analyzing sentiment:', err)
      results.metadata = {
        ...results.metadata,
        sentiment_analysis: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 6: Summarize the document
  if (options.summarize && results.extractedText) {
    try {
      const summary = await generateSummary(results.extractedText)
      results.metadata = {
        ...results.metadata,
        summary: {
          text: summary.summary,
          length: summary.wordCount,
          key_points: summary.keyPoints
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error summarizing document:', err)
      results.metadata = {
        ...results.metadata,
        summarization: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 7: Detect language
  if (options.detectLanguage && results.extractedText) {
    try {
      const language = detectLanguage(results.extractedText)
      results.metadata = {
        ...results.metadata,
        language: {
          detected: language.detected,
          confidence: language.confidence
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error detecting language:', err)
      results.metadata = {
        ...results.metadata,
        language_detection: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 8: Translate the document
  if (options.translate && results.extractedText && options.targetLanguage) {
    try {
      const translation = await translateText(results.extractedText, options.targetLanguage)
      results.metadata = {
        ...results.metadata,
        translation: {
          target_language: options.targetLanguage,
          text: translation.text
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error translating document:', err)
      results.metadata = {
        ...results.metadata,
        translation: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 9: Detect tables
  if (options.detectTables && results.extractedText) {
    try {
      const tables = detectTables(results.extractedText)
      results.metadata = {
        ...results.metadata,
        tables: {
          count: tables.length,
          data: tables
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error detecting tables:', err)
      results.metadata = {
        ...results.metadata,
        table_detection: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  // Step 10: Detect forms
  if (options.detectForms && results.extractedText) {
    try {
      const forms = detectForms(results.extractedText)
      results.metadata = {
        ...results.metadata,
        forms: {
          count: forms.length,
          data: forms
        }
      }
    } catch (err) {
      console.error('[DocumentProcessing] Error detecting forms:', err)
      results.metadata = {
        ...results.metadata,
        form_detection: {
          error: err instanceof Error ? err.message : String(err),
          status: 'failed'
        }
      }
    }
  }
  
  return results
}

// Extract basic metadata from document content
function extractBasicMetadata(content: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  
  // Extract document length
  metadata.length = {
    characters: content.length,
    words: content.split(/\s+/).filter(word => word.length > 0).length,
    pages: Math.ceil(content.length / 2000) // Approximate pages
  }
  
  // Extract creation date (if mentioned in content)
  const dateMatches = content.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g)
  if (dateMatches && dateMatches.length > 0) {
    metadata.creation_date = dateMatches[0]
  }
  
  // Extract author (if mentioned)
  const authorMatches = content.match(/\b(?:author|created by|prepared by|written by)\s*:?\s*([A-Z][a-z]+\s[A-Z][a-z]+)\b/i)
  if (authorMatches && authorMatches.length > 1) {
    metadata.author = authorMatches[1]
  }
  
  // Extract title (if available)
  const titleMatches = content.match(/^(?:title|subject)\s*:?\s*(.+)$/im)
  if (titleMatches && titleMatches.length > 1) {
    metadata.title = titleMatches[1].trim()
  }
  
  return metadata
}

// Detect language of text
function detectLanguage(text: string): { detected: string; confidence: number } {
  // Simple language detection based on common words
  // In a real implementation, you would use a proper language detection library
  
  const englishWords = ['the', 'and', 'of', 'to', 'in', 'is', 'it', 'that']
  const frenchWords = ['le', 'la', 'de', 'et', 'à', 'les', 'des', 'en']
  const spanishWords = ['el', 'la', 'de', 'y', 'a', 'en', 'que', 'los']
  const germanWords = ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu']
  
  const textLower = text.toLowerCase()
  
  const englishCount = englishWords.filter(word => textLower.includes(word)).length
  const frenchCount = frenchWords.filter(word => textLower.includes(word)).length
  const spanishCount = spanishWords.filter(word => textLower.includes(word)).length
  const germanCount = germanWords.filter(word => textLower.includes(word)).length
  
  const total = englishCount + frenchCount + spanishCount + germanCount
  
  if (total === 0) {
    return { detected: 'unknown', confidence: 0 }
  }
  
  const maxCount = Math.max(englishCount, frenchCount, spanishCount, germanCount)
  
  if (maxCount === englishCount) {
    return { detected: 'en', confidence: englishCount / total }
  } else if (maxCount === frenchCount) {
    return { detected: 'fr', confidence: frenchCount / total }
  } else if (maxCount === spanishCount) {
    return { detected: 'es', confidence: spanishCount / total }
  } else {
    return { detected: 'de', confidence: germanCount / total }
  }
}

// Translate text to target language
async function translateText(text: string, targetLanguage: string): Promise<{ text: string }> {
  // In a real implementation, you would call a translation API
  // For now, return a mock translation
  
  return {
    text: `[Translated to ${targetLanguage}] ${text.substring(0, 50)}...`
  }
}

// Detect tables in document content
function detectTables(content: string): Array<{
  headers: string[]
  rows: string[][]
}> {
  // Simple table detection - look for patterns that resemble tables
  // In a real implementation, you would use more sophisticated table detection
  
  const lines = content.split('\n')
  const tables: Array<{ headers: string[]; rows: string[][] }> = []
  
  // Look for potential table headers (lines with multiple words separated by pipes or spaces)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Check for pipe-separated values (common in markdown tables)
    if (line.includes('|')) {
      const headers = line.split('|').filter(cell => cell.trim().length > 0).map(cell => cell.trim())
      const rows = []
      
      // Look ahead for more table rows
      let j = i + 1
      while (j < lines.length && lines[j].includes('|')) {
        const row = lines[j].split('|').filter(cell => cell.trim().length > 0).map(cell => cell.trim())
        if (row.length === headers.length) {
          rows.push(row)
        }
        j++
      }
      
      if (headers.length > 1 && rows.length > 0) {
        tables.push({ headers, rows })
        i = j - 1 // Skip ahead
      }
    }
    // Check for space-separated values (common in text tables)
    else if (line.split(/\s{2,}/).length > 1) {
      const headers = line.split(/\s{2,}/).map(header => header.trim())
      const rows = []
      
      // Look ahead for more table rows
      let j = i + 1
      while (j < lines.length && lines[j].split(/\s{2,}/).length === headers.length) {
        const row = lines[j].split(/\s{2,}/).map(cell => cell.trim())
        rows.push(row)
        j++
      }
      
      if (headers.length > 1 && rows.length > 0) {
        tables.push({ headers, rows })
        i = j - 1 // Skip ahead
      }
    }
  }
  
  return tables
}

// Detect forms in document content
function detectForms(content: string): Array<{
  form_name: string
  fields: Array<{
    name: string
    type: string
    value?: string
  }>
}> {
  // Simple form detection - look for patterns that resemble forms
  // In a real implementation, you would use more sophisticated form detection
  
  const lines = content.split('\n')
  const forms: Array<{
    form_name: string
    fields: Array<{ name: string; type: string; value?: string }>
  }> = []
  
  // Look for form sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Check for form headers
    if (/^(?:form|application|request|registration)\s*:?\s*.+$/i.test(line)) {
      const formName = line.replace(/^(?:form|application|request|registration)\s*:?\s*/i, '').trim()
      const fields = []
      
      // Look ahead for form fields
      let j = i + 1
      while (j < lines.length && !/^(?:form|application|request|registration)\s*:?\s*.+$/i.test(lines[j])) {
        const fieldLine = lines[j].trim()
        
        // Check for field patterns: "Field Name:", "Field Name (Type):", etc.
        const fieldMatch = fieldLine.match(/^(.+?)\s*(?:\((.+?)\))?\s*:\s*(.*)$/)
        if (fieldMatch) {
          const fieldName = fieldMatch[1].trim()
          const fieldType = fieldMatch[2] ? fieldMatch[2].trim() : 'text'
          const fieldValue = fieldMatch[3] ? fieldMatch[3].trim() : undefined
          
          fields.push({
            name: fieldName,
            type: fieldType,
            value: fieldValue
          })
        }
        
        j++
      }
      
      if (fields.length > 0) {
        forms.push({
          form_name: formName || 'Untitled Form',
          fields
        })
        i = j - 1 // Skip ahead
      }
    }
  }
  
  return forms
}

// Process documents in bulk
export async function processDocumentsInBulk(
  organizationId: string,
  userId: string | null,
  documentIds: string[],
  options?: DocumentProcessingOptions
): Promise<{
  successCount: number
  failureCount: number
  results: Array<{
    documentId: string
    success: boolean
    error?: string
  }>
}> {
  let successCount = 0
  let failureCount = 0
  const results = []
  
  for (const documentId of documentIds) {
    try {
      const success = await processDocument(organizationId, userId, documentId, options)
      
      if (success) {
        successCount++
        results.push({ documentId, success: true })
      } else {
        failureCount++
        results.push({ documentId, success: false, error: 'Processing failed' })
      }
    } catch (err) {
      failureCount++
      results.push({
        documentId,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  
  return {
    successCount,
    failureCount,
    results
  }
}

// Get document processing status
export async function getDocumentProcessingStatus(
  organizationId: string,
  documentId: string
): Promise<{
  status: string
  progress?: number
  metadata?: Record<string, unknown>
  error?: string
}> {
  try {
    const supabase = await createServiceClient()
    
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('status, processing_started_at, processing_completed_at, processing_error, metadata')
      .eq('id', documentId)
      .eq('organization_id', organizationId)
      .single()
    
    if (docError || !document) {
      return { status: 'not_found' }
    }
    
    if (document.status === 'processing') {
      // Calculate progress based on time elapsed
      const startedAt = new Date(document.processing_started_at).getTime()
      const now = new Date().getTime()
      const progress = Math.min(95, Math.round(((now - startedAt) / (5 * 60 * 1000)) * 100)) // Assume 5 minutes max
      
      return {
        status: 'processing',
        progress,
        metadata: document.metadata
      }
    }
    
    return {
      status: document.status,
      metadata: document.metadata,
      error: document.processing_error
    }
  } catch (err) {
    console.error('[DocumentProcessing] Error getting processing status:', err)
    return {
      status: 'error',
      error: err instanceof Error ? err.message : String(err)
    }
  }
}