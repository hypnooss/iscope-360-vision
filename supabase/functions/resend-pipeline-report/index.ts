import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: require valid user session (admin)
    const authHeader = req.headers.get("Authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job
    const { data: job, error: jobErr } = await admin
      .from("api_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "completed" && job.status !== "partial") {
      return new Response(JSON.stringify({ error: "Job must be completed to resend report" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = job.metadata || {};
    const emailTo = metadata.email_to;
    if (!emailTo) {
      return new Response(JSON.stringify({ error: "No email_to found in job metadata" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domainId = job.domain_id;
    if (!domainId) {
      return new Response(JSON.stringify({ error: "No domain_id on job" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch domain
    const { data: domain } = await admin
      .from("external_domains")
      .select("id, domain")
      .eq("id", domainId)
      .maybeSingle();

    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch latest compliance analysis
    const { data: analysis } = await admin
      .from("external_domain_analysis_history")
      .select("id, score, report_data, created_at")
      .eq("domain_id", domainId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch latest attack surface snapshot
    const { data: snapshot } = await admin
      .from("attack_surface_snapshots")
      .select("id, score, summary, completed_at")
      .eq("client_id", job.client_id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count findings
    const complianceScore = analysis?.score ?? "N/A";
    const attackSurfaceScore = snapshot?.score ?? "N/A";
    const attackSummary = (snapshot?.summary as Record<string, any>) || {};

    let critical = 0, high = 0, medium = 0, low = 0;
    if (analysis?.report_data?.categories) {
      const categories = (analysis.report_data as any).categories;
      for (const catKey of Object.keys(categories)) {
        const checks = categories[catKey];
        if (Array.isArray(checks)) {
          for (const check of checks) {
            if (check.status === "fail") {
              switch (check.severity) {
                case "critical": critical++; break;
                case "high": high++; break;
                case "medium": medium++; break;
                case "low": low++; break;
              }
            }
          }
        }
      }
    }

    // Generate new access token
    const accessToken = crypto.randomUUID();
    await admin.from("api_jobs").update({ access_token: accessToken }).eq("id", job.id);

    const appUrl = metadata.app_url || "https://iscope-teste.lovable.app";
    const reportUrl = `${appUrl}/report/${accessToken}`;

    // Send email
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: "domain-security-report",
        recipientEmail: emailTo,
        idempotencyKey: `resend-report-${job.id}-${Date.now()}`,
        templateData: {
          domain: domain.domain,
          complianceScore,
          attackSurfaceScore,
          analysisDate: analysis?.created_at || new Date().toISOString(),
          findings: { critical, high, medium, low },
          network: {
            totalIPs: attackSummary.total_ips || 0,
            openPorts: attackSummary.open_ports || 0,
            services: attackSummary.services || 0,
            cves: attackSummary.cves || 0,
          },
          reportUrl,
        },
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error("Resend email failed:", errBody);
      return new Response(JSON.stringify({ error: "Email send failed", details: errBody }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await emailResponse.json();

    return new Response(JSON.stringify({ success: true, email_to: emailTo, reportUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("resend-pipeline-report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
