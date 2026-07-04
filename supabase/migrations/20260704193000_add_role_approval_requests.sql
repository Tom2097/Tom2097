-- Create role_approval_requests table for role approval workflow
CREATE TABLE IF NOT EXISTS public.role_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  UNIQUE(user_id, organization_id, requested_role)
);

-- Enable Row Level Security
ALTER TABLE public.role_approval_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for users to create their own requests
CREATE POLICY "Users can create their own role approval requests"
ON public.role_approval_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to view their own requests
CREATE POLICY "Users can view their own role approval requests"
ON public.role_approval_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for admins to manage all requests
CREATE POLICY "Admins can manage all role approval requests"
ON public.role_approval_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.organization_id = role_approval_requests.organization_id
    AND organization_members.role IN ('owner', 'admin')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_role_approval_requests_user_id ON public.role_approval_requests(user_id);
CREATE INDEX idx_role_approval_requests_org_id ON public.role_approval_requests(organization_id);
CREATE INDEX idx_role_approval_requests_status ON public.role_approval_requests(status);