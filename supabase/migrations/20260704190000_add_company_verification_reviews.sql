-- Create company_verification_reviews table for manual review workflow
CREATE TABLE IF NOT EXISTS public.company_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  admin_notes TEXT,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.company_verification_reviews ENABLE ROW LEVEL SECURITY;

-- Create policy for users to create their own reviews
CREATE POLICY "Users can create their own verification reviews"
ON public.company_verification_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to view their own reviews
CREATE POLICY "Users can view their own verification reviews"
ON public.company_verification_reviews
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for admins to manage all reviews
CREATE POLICY "Admins can manage all verification reviews"
ON public.company_verification_reviews
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX idx_company_verification_reviews_user_id ON public.company_verification_reviews(user_id);
CREATE INDEX idx_company_verification_reviews_status ON public.company_verification_reviews(status);