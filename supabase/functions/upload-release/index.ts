import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req: Request) => {
  if (req.method !== 'PUT') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get('file');
  if (!filename) {
    return new Response('Missing file param', { status: 400 });
  }

  const body = await req.arrayBuffer();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.storage
    .from('agent-releases')
    .upload(filename, body, {
      contentType: 'application/gzip',
      upsert: true,
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, file: filename, size: body.byteLength }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
