
-- 1. Enable pgmq extension
CREATE EXTENSION IF NOT EXISTS pgmq;

-- 2. Create email_send_log table
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- No public access - only service_role can access
CREATE POLICY "Service role full access on email_send_log"
  ON public.email_send_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Create email_send_state table (single-row config)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  batch_size integer NOT NULL DEFAULT 10,
  send_delay_ms integer NOT NULL DEFAULT 200,
  rate_limited_until timestamptz,
  auth_email_ttl_minutes integer NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_send_state"
  ON public.email_send_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default config
INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 4. Create suppressed_emails table
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'unsubscribe',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on suppressed_emails"
  ON public.suppressed_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Create email_unsubscribe_tokens table
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Create pgmq queues
SELECT pgmq.create('auth_emails');
SELECT pgmq.create('transactional_emails');

-- 7. Create RPC wrappers (SECURITY DEFINER to allow Edge Functions to call via service_role)

-- enqueue_email: adds a message to the specified queue
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_id bigint;
BEGIN
  SELECT pgmq.send(queue_name, payload) INTO msg_id;
  RETURN msg_id;
END;
$$;

-- read_email_batch: reads up to N messages from queue with visibility timeout
CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer DEFAULT 10, visibility_timeout integer DEFAULT 30)
RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
    FROM pgmq.read(queue_name, visibility_timeout, batch_size) r;
END;
$$;

-- delete_email: removes a processed message from queue
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
END;
$$;

-- move_to_dlq: archives a failed message to the DLQ queue
CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, message_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_record record;
  dlq_id bigint;
BEGIN
  -- Read the message to get its content
  SELECT r.message INTO msg_record
    FROM pgmq.read(source_queue, 0, 1) r
    WHERE r.msg_id = message_id
    LIMIT 1;

  IF msg_record IS NULL THEN
    RETURN -1;
  END IF;

  -- Send to DLQ queue (create if not exists)
  BEGIN
    SELECT pgmq.send(source_queue || '_dlq', msg_record.message) INTO dlq_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pgmq.create(source_queue || '_dlq');
    SELECT pgmq.send(source_queue || '_dlq', msg_record.message) INTO dlq_id;
  END;

  -- Delete from source queue
  PERFORM pgmq.delete(source_queue, message_id);

  RETURN dlq_id;
END;
$$;

-- Grant execute to service_role and authenticated
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, bigint) TO service_role;
