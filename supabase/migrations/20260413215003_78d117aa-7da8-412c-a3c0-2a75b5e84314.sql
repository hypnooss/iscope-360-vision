
-- Allow public read of completed api_jobs by access_token
CREATE POLICY "Public can read jobs by access_token"
ON public.api_jobs FOR SELECT
TO anon
USING (access_token IS NOT NULL AND status = 'completed');

-- Allow anon to read external_domains (domain name only, filtered by ID in app)
CREATE POLICY "Anon can read external domains for public reports"
ON public.external_domains FOR SELECT
TO anon
USING (true);

-- Allow anon to read analysis history for public reports
CREATE POLICY "Anon can read analysis history for public reports"
ON public.external_domain_analysis_history FOR SELECT
TO anon
USING (true);
