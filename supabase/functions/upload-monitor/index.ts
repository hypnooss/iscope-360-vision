import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.arrayBuffer();
  const { error } = await supabase.storage.from("agent-releases").upload("iscope-monitor-latest.tar.gz", body, { contentType: "application/gzip", upsert: true });
  if (error) return new Response(JSON.stringify({ error }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
