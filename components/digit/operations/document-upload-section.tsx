'use client'

import dynamic from 'next/dynamic'
import { FileText } from 'lucide-react'

const DocumentUpload = dynamic(
  () => import('@/components/digit/operations/document-upload').then(m => ({ default: m.DocumentUpload })),
  { ssr: false }
)

export function DocumentUploadSection() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Document Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Upload files or paste text to generate data reports and insights
          </p>
        </div>
      </div>
      <DocumentUpload />
    </div>
  )
}