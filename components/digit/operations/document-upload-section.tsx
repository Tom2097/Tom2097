'use client'
import { T } from "@/components/i18n/t"

import dynamic from 'next/dynamic'

const DocumentUpload = dynamic(
  () => import('@/components/digit/operations/document-upload').then(m => ({ default: m.DocumentUpload })),
  { ssr: false }
)

export function DocumentUploadSection() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground"><T>Upload & Analyze Documents</T></h2>
          <p className="text-sm text-muted-foreground"><T>Upload files, paste text, or drop content below to generate instant reports</T></p>
        </div>
      </div>
      <DocumentUpload />
    </div>
  )
}