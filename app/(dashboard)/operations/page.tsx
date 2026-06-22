import { GenericWorkspace } from '@/components/digit/generic-workspace'
import { DocumentUploadSection } from '@/components/digit/operations/document-upload-section'

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <DocumentUploadSection />
      <GenericWorkspace title="Operations Workspace" />
    </div>
  )
}