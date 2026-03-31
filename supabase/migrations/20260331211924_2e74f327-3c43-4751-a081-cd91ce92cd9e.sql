
DROP POLICY "Service role can insert API access logs" ON public.api_access_logs;

CREATE POLICY "Service role can insert API access logs"
  ON public.api_access_logs FOR INSERT TO service_role
  WITH CHECK (true);
