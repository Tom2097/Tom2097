export type ConnectorType = "gmail" | "google_drive" | "slack" | "custom"

export interface ConnectorConfig {
  id: string
  organization_id: string
  name: string
  type: ConnectorType
  enabled: boolean
  credentials: Record<string, unknown>
  settings: Record<string, unknown>
  last_sync_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConnectorInput {
  name: string
  type: ConnectorType
  credentials: Record<string, unknown>
  settings?: Record<string, unknown>
}

export interface SyncResult {
  connector_id: string
  type: ConnectorType
  items_processed: number
  items_created: number
  errors: string[]
  completed_at: string
}
