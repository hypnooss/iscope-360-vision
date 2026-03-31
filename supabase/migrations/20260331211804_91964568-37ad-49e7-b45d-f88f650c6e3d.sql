
-- Table: api_access_keys
CREATE TABLE public.api_access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_api_access_keys_hash ON public.api_access_keys(key_hash);
CREATE INDEX idx_api_access_keys_client ON public.api_access_keys(client_id);
CREATE INDEX idx_api_access_keys_active ON public.api_access_keys(is_active) WHERE is_active = true;

CREATE TRIGGER update_api_access_keys_updated_at
  BEFORE UPDATE ON public.api_access_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.api_access_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage API access keys"
  ON public.api_access_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Table: api_access_logs
CREATE TABLE public.api_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_access_keys(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer NOT NULL DEFAULT 200,
  ip_address text,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_access_logs_key ON public.api_access_logs(api_key_id);
CREATE INDEX idx_api_access_logs_created ON public.api_access_logs(created_at DESC);

ALTER TABLE public.api_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read API access logs"
  ON public.api_access_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role can insert API access logs"
  ON public.api_access_logs FOR INSERT
  WITH CHECK (true);
