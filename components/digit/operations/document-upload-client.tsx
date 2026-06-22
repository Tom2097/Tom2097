'use client'

import dynamic from 'next/dynamic'

const DocumentUpload = dynamic(
  () => import('@/components/digit/operations/document-upload').then(mod => ({ default: mod.DocumentUpload })),
  { ssr: false }
)

export function DocumentUploadClient() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6">
      <DocumentUpload />
    </div>
  )
}