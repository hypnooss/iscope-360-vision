
-- Drop overly permissive anon policies
DROP POLICY IF EXISTS "Anon can read external domains for public reports" ON public.external_domains;
DROP POLICY IF EXISTS "Anon can read analysis history for public reports" ON public.external_domain_analysis_history;

-- Tightened: anon can only read domains that belong to a completed job with access_token
CREATE POLICY "Anon can read domains via public report token"
ON public.external_domains FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.api_jobs
    WHERE api_jobs.domain_id = external_domains.id
      AND api_jobs.access_token IS NOT NULL
      AND api_jobs.status = 'completed'
  )
);

-- Tightened: anon can only read analysis history for domains in public reports
CREATE POLICY "Anon can read analysis via public report token"
ON public.external_domain_analysis_history FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.api_jobs
    WHERE api_jobs.domain_id = external_domain_analysis_history.domain_id
      AND api_jobs.access_token IS NOT NULL
      AND api_jobs.status = 'completed'
  )
);
