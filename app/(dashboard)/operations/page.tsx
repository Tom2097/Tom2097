import { GenericWorkspace } from '@/components/digit/generic-workspace'
import { DocumentUploadClient } from '@/components/digit/operations/document-upload-client'

export default function OperationsPage() {
  return (
    <div className="space-y-8">
      <GenericWorkspace title="Operations Workspace" />
      <DocumentUploadClient />
    </div>
  )
}