import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'

// List of all available permissions
const PERMISSIONS = [
  // Workspace permissions
  { id: 'workspace:read', name: 'View workspaces', description: 'View workspace content and settings', category: 'workspaces' },
  { id: 'workspace:create', name: 'Create workspaces', description: 'Create new workspaces', category: 'workspaces' },
  { id: 'workspace:update', name: 'Update workspaces', description: 'Modify workspace settings', category: 'workspaces' },
  { id: 'workspace:delete', name: 'Delete workspaces', description: 'Delete workspaces', category: 'workspaces' },
  
  // Document permissions
  { id: 'document:read', name: 'View documents', description: 'View documents and files', category: 'documents' },
  { id: 'document:create', name: 'Upload documents', description: 'Upload new documents', category: 'documents' },
  { id: 'document:update', name: 'Edit documents', description: 'Modify document content', category: 'documents' },
  { id: 'document:delete', name: 'Delete documents', description: 'Delete documents', category: 'documents' },
  
  // AI Intelligence permissions
  { id: 'ai:read', name: 'View AI features', description: 'View AI intelligence features', category: 'ai' },
  { id: 'ai:train', name: 'Train AI models', description: 'Train and fine-tune AI models', category: 'ai' },
  { id: 'ai:deploy', name: 'Deploy AI models', description: 'Deploy trained AI models', category: 'ai' },
  { id: 'ai:predict', name: 'Use AI predictions', description: 'Make predictions using AI models', category: 'ai' },
  
  // Operational permissions
  { id: 'operational:read', name: 'View operational data', description: 'View operational workspace data', category: 'operational' },
  { id: 'operational:report', name: 'Generate reports', description: 'Generate and view operational reports', category: 'operational' },
  { id: 'operational:route', name: 'Configure routing', description: 'Configure document routing rules', category: 'operational' },
  
  // CRM permissions
  { id: 'crm:read', name: 'View CRM data', description: 'View customer relationship management data', category: 'crm' },
  { id: 'crm:create', name: 'Create CRM records', description: 'Create new CRM records (contacts, deals, etc.)', category: 'crm' },
  { id: 'crm:update', name: 'Update CRM records', description: 'Modify existing CRM records', category: 'crm' },
  { id: 'crm:delete', name: 'Delete CRM records', description: 'Delete CRM records', category: 'crm' },
  { id: 'crm:analytics', name: 'View CRM analytics', description: 'View CRM analytics and reports', category: 'crm' },
  
  // Billing permissions
  { id: 'billing:read', name: 'View billing', description: 'View billing information and usage', category: 'billing' },
  { id: 'billing:manage', name: 'Manage billing', description: 'Manage billing settings and subscriptions', category: 'billing' },
  
  // Admin permissions
  { id: 'admin:read', name: 'View admin settings', description: 'View administrative settings', category: 'admin' },
  { id: 'admin:manage', name: 'Manage admin settings', description: 'Manage administrative settings and configurations', category: 'admin' },
  { id: 'admin:users', name: 'Manage users', description: 'Manage user accounts and permissions', category: 'admin' },
  { id: 'admin:roles', name: 'Manage roles', description: 'Create, update, and delete roles', category: 'admin' },
  { id: 'admin:impersonate', name: 'Impersonate users', description: 'Impersonate other users for troubleshooting', category: 'admin' }
]

export async function GET(_req: NextRequest) {
  try {
    await getAuthenticatedUser() // Just verify authentication
    return NextResponse.json({
      success: true,
      permissions: PERMISSIONS
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}