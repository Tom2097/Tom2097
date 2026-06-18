import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  getUploadedFile,
  deleteUploadedFile,
} from "@/lib/analytics/file-upload"
import type { FileAnalysisResult } from "@/lib/analytics/file-upload"

/**
 * GET /api/v1/analytics/files/[fileId]
 * Get a specific file and its analysis results.
 * 
 * Response:
 * {
 *   "success": boolean
 *   "file": UploadedFile
 *   "result"?: FileAnalysisResult
 * }
 */

interface FileDetailResponse {
  success: boolean
  file?: any
  result?: FileAnalysisResult
  error?: string
}

const getHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Extract fileId from URL path
      const pathParts = req.nextUrl.pathname.split('/')
      const fileId = pathParts[pathParts.length - 1]
      
      if (!fileId) {
        return NextResponse.json(
          { success: false, error: "fileId is required in URL path" } as FileDetailResponse,
          { status: 400 }
        )
      }
      
      const file = await getUploadedFile(organizationId, fileId)
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: "File not found" } as FileDetailResponse,
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        file: {
          id: file.id,
          filename: file.originalFilename,
          fileType: file.fileType,
          fileSize: file.fileSize,
          uploadedAt: file.uploadedAt,
          status: file.status,
          analysisType: file.analysisType,
        },
        result: file.analysisResult as FileAnalysisResult | undefined,
      } as FileDetailResponse, { status: 200 })

    } catch (error) {
      console.error("[File Upload API] GET File Error:", error)
      
      return NextResponse.json(
        { success: false, error: "Failed to get file" } as FileDetailResponse,
        { status: 500 }
      )
    }
  }
)

/**
 * DELETE /api/v1/analytics/files/[fileId]
 * Delete an uploaded file.
 * 
 * Response:
 * {
 *   "success": boolean
 *   "deleted": boolean
 * }
 */

interface FileDeleteResponse {
  success: boolean
  deleted?: boolean
  error?: string
}

const deleteHandler = withAuth(
  async (req: NextRequest, { organizationId }) => {
    try {
      // Extract fileId from URL path
      const pathParts = req.nextUrl.pathname.split('/')
      const fileId = pathParts[pathParts.length - 1]
      
      if (!fileId) {
        return NextResponse.json(
          { success: false, error: "fileId is required in URL path" } as FileDeleteResponse,
          { status: 400 }
        )
      }
      
      const deleted = await deleteUploadedFile(organizationId, fileId)
      
      return NextResponse.json({
        success: true,
        deleted,
      } as FileDeleteResponse, { status: 200 })

    } catch (error) {
      console.error("[File Upload API] DELETE Error:", error)
      
      return NextResponse.json(
        { success: false, error: "Failed to delete file" } as FileDeleteResponse,
        { status: 500 }
      )
    }
  }
)

export { getHandler as GET, deleteHandler as DELETE }
