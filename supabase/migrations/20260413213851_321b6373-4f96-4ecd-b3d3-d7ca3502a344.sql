
-- Add access_token column for public report access
ALTER TABLE public.api_jobs ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;

-- Index for fast lookups by token
CREATE INDEX IF NOT EXISTS idx_api_jobs_access_token ON public.api_jobs (access_token) WHERE access_token IS NOT NULL;

-- Create reports storage bucket (private — access via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;
