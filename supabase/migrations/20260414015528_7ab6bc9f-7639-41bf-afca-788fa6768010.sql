
-- Allow anon to read attack_surface_snapshots linked to a valid job token
CREATE POLICY "anon_read_attack_surface_via_job_token"
ON public.attack_surface_snapshots
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.api_jobs aj
    WHERE aj.client_id = attack_surface_snapshots.client_id
      AND aj.access_token IS NOT NULL
      AND aj.status = 'completed'
  )
);
