import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { client_id, ip, source, label } = await req.json();

    if (!client_id || !ip || !source) {
      return new Response(
        JSON.stringify({ error: "client_id, ip and source are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create snapshot with a single source IP
    const sourceIps = [{ ip, source, label: label || ip }];
    const { data: snapshot, error: snapErr } = await supabase
      .from("attack_surface_snapshots")
      .insert({
        client_id,
        status: "pending",
        source_ips: sourceIps,
        results: {},
        cve_matches: [],
        summary: { total_ips: 1, open_ports: 0, services: 0, cves: 0 },
      })
      .select("id")
      .single();

    if (snapErr) throw snapErr;

    // 2. Create a single task for this IP
    const { error: taskErr } = await supabase
      .from("attack_surface_tasks")
      .insert({
        snapshot_id: snapshot.id,
        ip,
        source,
        label: label || ip,
        status: "pending",
      });

    if (taskErr) throw taskErr;

    return new Response(
      JSON.stringify({ success: true, snapshot_id: snapshot.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("attack-surface-rescan-ip error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
