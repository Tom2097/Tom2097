-- Create kyc_verification_results table for storing KYC verification results
CREATE TABLE IF NOT EXISTS public.kyc_verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score FLOAT NOT NULL DEFAULT 0,
  face_match BOOLEAN,
  id_valid BOOLEAN,
  id_type TEXT,
  id_number TEXT,
  name_match BOOLEAN,
  name_on_id TEXT,
  date_of_birth TEXT,
  address_match BOOLEAN,
  address_on_id TEXT,
  verification_method TEXT,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  manual_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.kyc_verification_results ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own results
CREATE POLICY "Users can view their own KYC verification results"
ON public.kyc_verification_results
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for admins to manage all results
CREATE POLICY "Admins can manage all KYC verification results"
ON public.kyc_verification_results
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX idx_kyc_verification_results_user_id ON public.kyc_verification_results(user_id);

-- Create kyc_verification_reviews table for manual review workflow
CREATE TABLE IF NOT EXISTS public.kyc_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  selfie_image TEXT,
  id_type TEXT NOT NULL,
  id_number TEXT,
  id_front_image TEXT,
  id_back_image TEXT,
  full_name TEXT,
  date_of_birth TEXT,
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
ALTER TABLE public.kyc_verification_reviews ENABLE ROW LEVEL SECURITY;

-- Create policy for users to create their own reviews
CREATE POLICY "Users can create their own KYC verification reviews"
ON public.kyc_verification_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to view their own reviews
CREATE POLICY "Users can view their own KYC verification reviews"
ON public.kyc_verification_reviews
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for admins to manage all reviews
CREATE POLICY "Admins can manage all KYC verification reviews"
ON public.kyc_verification_reviews
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX idx_kyc_verification_reviews_user_id ON public.kyc_verification_reviews(user_id);
CREATE INDEX idx_kyc_verification_reviews_status ON public.kyc_verification_reviews(status);