
-- Table: api_jobs
CREATE TABLE public.api_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_access_keys(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES public.external_domains(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'full_pipeline',
  status text NOT NULL DEFAULT 'queued',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step text,
  metadata jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Indexes
CREATE INDEX idx_api_jobs_status ON public.api_jobs(status);
CREATE INDEX idx_api_jobs_client_id ON public.api_jobs(client_id);
CREATE INDEX idx_api_jobs_api_key_id ON public.api_jobs(api_key_id);
CREATE INDEX idx_api_jobs_domain_id ON public.api_jobs(domain_id);
CREATE INDEX idx_api_jobs_created_at ON public.api_jobs(created_at DESC);

-- RLS
ALTER TABLE public.api_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all jobs"
  ON public.api_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role full access to api_jobs"
  ON public.api_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
