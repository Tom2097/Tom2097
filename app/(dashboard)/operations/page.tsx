import { GenericWorkspace } from '@/components/digit/generic-workspace'
import { DocumentUploadSection } from '@/components/digit/operations/document-upload-section'

export default function OperationsPage() {
  return (
    <div className="space-y-8">
      <GenericWorkspace title="Operations Workspace" />
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <DocumentUploadSection />
      </div>
    </div>
  )
}