'use client'

import dynamic from 'next/dynamic'

const DocumentUpload = dynamic(
  () => import('@/components/digit/operations/document-upload').then(m => ({ default: m.DocumentUpload })),
  { ssr: false }
)

export function DocumentUploadSection() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <p className="text-sm text-muted-foreground">Upload files or paste text to analyze and generate reports</p>
      </div>
      <DocumentUpload />
    </div>
  )
}