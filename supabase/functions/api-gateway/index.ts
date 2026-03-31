import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return respond({ error: "API key required", code: "MISSING_KEY" }, 401);

  let keyRecord: any = null;
  let statusCode = 200;

  try {
    const keyHash = await sha256(apiKey);
    const { data, error } = await adminClient
      .from("api_access_keys")
      .select("id, client_id, scopes, is_active, expires_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error || !data) return respond({ error: "Invalid API key", code: "INVALID_KEY" }, 401);
    keyRecord = data;

    if (!data.is_active) return respond({ error: "API key revoked", code: "KEY_REVOKED" }, 403);
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return respond({ error: "API key expired", code: "KEY_EXPIRED" }, 403);
    }

    // Update last_used_at
    await adminClient
      .from("api_access_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    // Parse route
    const url = new URL(req.url);
    const pathParts = url.pathname.replace(/^\/api-gateway\/?/, "").split("/").filter(Boolean);
    // Expected: v1/domains, v1/domains/:id/report, v1/domains/:id/analyze

    if (pathParts[0] !== "v1") {
      statusCode = 404;
      return respond({ error: "API version not found. Use /v1/", code: "NOT_FOUND" }, 404);
    }

    const resource = pathParts[1];
    const resourceId = pathParts[2];
    const subResource = pathParts[3];

    // === DOMAINS ===
    if (resource === "domains") {
      // GET /v1/domains — list domains
      if (!resourceId && req.method === "GET") {
        if (!data.scopes.includes("external_domain:read")) {
          statusCode = 403;
          return respond({ error: "Scope external_domain:read required", code: "INSUFFICIENT_SCOPE" }, 403);
        }

        const { data: domains, error: dErr } = await adminClient
          .from("external_domains")
          .select("id, domain, name, status, last_score, last_scan_at, created_at")
          .eq("client_id", data.client_id)
          .order("created_at", { ascending: false });

        if (dErr) throw dErr;
        return respond({ domains: domains || [] });
      }

      // GET /v1/domains/:id/report
      if (resourceId && subResource === "report" && req.method === "GET") {
        if (!data.scopes.includes("external_domain:report")) {
          statusCode = 403;
          return respond({ error: "Scope external_domain:report required", code: "INSUFFICIENT_SCOPE" }, 403);
        }

        // Verify domain belongs to client
        const { data: domain } = await adminClient
          .from("external_domains")
          .select("id")
          .eq("id", resourceId)
          .eq("client_id", data.client_id)
          .maybeSingle();

        if (!domain) {
          statusCode = 404;
          return respond({ error: "Domain not found", code: "NOT_FOUND" }, 404);
        }

        const { data: report, error: rErr } = await adminClient
          .from("external_domain_analysis_history")
          .select("id, score, report_data, source, status, created_at, completed_at, execution_time_ms")
          .eq("domain_id", resourceId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rErr) throw rErr;
        if (!report) {
          statusCode = 404;
          return respond({ error: "No completed analysis found", code: "NO_REPORT" }, 404);
        }

        return respond({ report });
      }

      // POST /v1/domains/:id/analyze
      if (resourceId && subResource === "analyze" && req.method === "POST") {
        if (!data.scopes.includes("external_domain:analyze")) {
          statusCode = 403;
          return respond({ error: "Scope external_domain:analyze required", code: "INSUFFICIENT_SCOPE" }, 403);
        }

        const { data: domain } = await adminClient
          .from("external_domains")
          .select("id, domain, agent_id")
          .eq("id", resourceId)
          .eq("client_id", data.client_id)
          .maybeSingle();

        if (!domain) {
          statusCode = 404;
          return respond({ error: "Domain not found", code: "NOT_FOUND" }, 404);
        }

        // Create analysis record
        const { data: analysis, error: aErr } = await adminClient
          .from("external_domain_analysis_history")
          .insert({
            domain_id: domain.id,
            source: "api",
            status: "pending",
          })
          .select("id")
          .single();

        if (aErr) throw aErr;

        // Create agent task if agent assigned
        if (domain.agent_id) {
          await adminClient.from("agent_tasks").insert({
            agent_id: domain.agent_id,
            task_type: "external_domain_analysis",
            target_id: domain.id,
            target_type: "external_domain",
            payload: { analysis_id: analysis.id, domain: domain.domain },
            priority: 5,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });
        }

        return respond({
          message: "Analysis triggered",
          analysis_id: analysis.id,
          domain: domain.domain,
        }, 202);
      }
    }

    statusCode = 404;
    return respond({ error: "Endpoint not found", code: "NOT_FOUND" }, 404);
  } catch (err) {
    console.error("api-gateway error:", err);
    statusCode = 500;
    return respond({ error: "Internal server error" }, 500);
  } finally {
    // Log access
    if (keyRecord) {
      const url = new URL(req.url);
      try {
        await adminClient.from("api_access_logs").insert({
          api_key_id: keyRecord.id,
          endpoint: url.pathname.replace(/^\/api-gateway\/?/, "/"),
          method: req.method,
          status_code: statusCode,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
          response_time_ms: Date.now() - startTime,
        });
      } catch (_) { /* non-critical */ }
    }
  }
});
