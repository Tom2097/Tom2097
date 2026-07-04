import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { FileData } from "@/lib/analytics/types"
import {
  processUploadedFile,
  getUploadedFiles,
} from "@/lib/analytics/file-upload"
import type { FileAnalysisOptions, AnalysisType, FileAnalysisResult } from "@/lib/analytics/file-upload"

/**
 * POST /api/v1/analytics/files
 * Upload and analyze a file.
 * 
 * Request body (multipart/form-data):
 * - file: File to upload (required)
 * - analysisType: "text_extraction" | "data_analysis" | "document_summary" | "entity_extraction" | "sentiment_analysis" | "custom_prompt"
 * - customPrompt: For custom_prompt analysis type
 * - questions: JSON array of questions to answer
 * - extractFields: JSON array of fields to extract
 * - includeRawText: boolean
 * 
 * OR (for text-based uploads):
 * {
 *   "content": "string - File content",
 *   "filename": "string - Filename",
 *   "contentType": "string - MIME type",
 *   "analysisType": "string",
 *   ...other options
 * }
 */

interface FileUploadRequest {
  content?: string
  filename?: string
  contentType?: string
  analysisType?: AnalysisType
  customPrompt?: string
  questions?: string[]
  extractFields?: string[]
  includeRawText?: boolean
  outputFormat?: "json" | "markdown" | "text"
}

interface FileUploadResponse {
  success: boolean
  file?: FileData
  result?: FileAnalysisResult
  error?: string
  fileId?: string
}

const postHandler = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    try {
      const startTime = Date.now()
      const formData = await req.formData()
      
      const file = formData.get("file") as File | null
      const content = formData.get("content") as string | null
      
      const filename = (formData.get("filename") as string) || "uploaded-file"
      const contentType = (formData.get("contentType") as string) || "text/plain"
      const analysisType = (formData.get("analysisType") as AnalysisType) || "document_summary"
      const customPrompt = formData.get("customPrompt") as string | null
      const questions = formData.get("questions") ? JSON.parse(formData.get("questions") as string) : undefined
      const extractFields = formData.get("extractFields") ? JSON.parse(formData.get("extractFields") as string) : undefined
      const includeRawText = formData.get("includeRawText") === "true"
      const outputFormat = (formData.get("outputFormat") as "json" | "markdown" | "text") || "json"
      
      let fileContent = content || ""
      let actualFilename = filename
      let actualContentType = contentType
      
      if (file) {
        actualFilename = file.name
        actualContentType = file.type
        fileContent = await file.text()
      }
      
      if (!fileContent) {
        return NextResponse.json(
          { success: false, error: "No file content provided" } as FileUploadResponse,
          { status: 400 }
        )
      }
      
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const options: FileAnalysisOptions = {
        analysisType,
        customPrompt: customPrompt || undefined,
        questions,
        extractFields,
        outputFormat,
        includeRawText,
        maxOutputTokens: 4000,
        temperature: 0.3,
      }
      
      const uploadedFile = await processUploadedFile(
        organizationId,
        userId,
        {
          id: fileId,
          filename: fileId,
          originalFilename: actualFilename,
          content: fileContent,
          contentType: actualContentType,
          size: fileContent.length,
        },
        analysisType,
        options
      )
      
      const processingTime = Date.now() - startTime
      const result = uploadedFile.analysisResult as FileAnalysisResult | undefined

      return NextResponse.json({
        success: true,
        file: {
          ...uploadedFile,
          name: uploadedFile.filename,
          type: uploadedFile.fileType,
          created_at: uploadedFile.uploadedAt,
        },
        result,
        fileId: uploadedFile.id,
        processingTime,
      }, { status: 200 })

    } catch (error) {
      console.error("[File Upload API] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" } as FileUploadResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read", "analytics:write"] }
)

/**
 * GET /api/v1/analytics/files
 * List uploaded files.
 */

interface FilesListResponse {
  success: boolean
  files?: FileData[]
  total?: number
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      const { searchParams } = new URL(req.url)
      
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50
      const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0
      const status = searchParams.get("status") || undefined
      const analysisType = searchParams.get("analysisType") as AnalysisType || undefined
      const userId = searchParams.get("userId") || undefined
      
      const files = await getUploadedFiles(organizationId, {
        limit,
        offset,
        status,
        analysisType,
        userId,
      })
      
       return NextResponse.json({
         success: true,
         files: files.map(f => ({
           ...f,
           name: f.originalFilename,
           size: f.fileSize,
           type: f.fileType,
           created_at: f.uploadedAt,
           filename: f.originalFilename,
         })),
         total: files.length,
       } as FilesListResponse, { status: 200 })

    } catch (error) {
      console.error("[File Upload API] GET Error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to get uploaded files" } as FilesListResponse,
        { status: 500 }
      )
    }
  },
  { requireAll: ["analytics:read"] }
)

export { getHandler as GET, postHandler as POST }
