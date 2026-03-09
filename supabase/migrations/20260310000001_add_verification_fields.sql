-- Add identity verification fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_type TEXT
    CHECK (verification_type IN ('creator', 'institution', 'curator')),
  ADD COLUMN IF NOT EXISTS portfolio TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS username_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_payment_method TEXT
    CHECK (verification_payment_method IN ('fiat', 'aif')),
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;

-- Index for admin queries on pending verifications
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON public.users (verification_status);
