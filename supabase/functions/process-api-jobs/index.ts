import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch jobs that need processing
    const { data: jobs, error: fetchErr } = await admin
      .from("api_jobs")
      .select("*")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const job of jobs) {
      try {
        const steps: any[] = job.steps || [];
        
        // Find next actionable step
        const nextStep = steps.find((s: any) => {
          if (s.status !== "pending") return false;
          if (!s.depends_on) return true;
          const dep = steps.find((d: any) => d.name === s.depends_on);
          return dep && dep.status === "completed";
        });

        if (!nextStep) {
          // Check if all steps completed
          const allDone = steps.every((s: any) => s.status === "completed");
          const anyFailed = steps.some((s: any) => s.status === "failed");
          
          if (allDone) {
            await admin.from("api_jobs").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              current_step: null,
            }).eq("id", job.id);
          } else if (anyFailed) {
            await admin.from("api_jobs").update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: "One or more steps failed",
            }).eq("id", job.id);
          }
          continue;
        }

        // Mark job as running
        if (job.status === "queued") {
          await admin.from("api_jobs").update({
            status: "running",
            started_at: new Date().toISOString(),
            current_step: nextStep.name,
          }).eq("id", job.id);
        } else {
          await admin.from("api_jobs").update({
            current_step: nextStep.name,
          }).eq("id", job.id);
        }

        // Update step to running
        nextStep.status = "running";
        nextStep.started_at = new Date().toISOString();
        await admin.from("api_jobs").update({ steps }).eq("id", job.id);

        // Execute step
        try {
          const result = await executeStep(admin, job, nextStep);
          nextStep.status = "completed";
          nextStep.completed_at = new Date().toISOString();
          nextStep.result = result;

          // If register step, save domain_id to job
          if (nextStep.name === "register" && result?.domain_id) {
            await admin.from("api_jobs").update({
              steps,
              domain_id: result.domain_id,
            }).eq("id", job.id);
          } else {
            await admin.from("api_jobs").update({ steps }).eq("id", job.id);
          }
        } catch (stepErr: any) {
          nextStep.status = "failed";
          nextStep.completed_at = new Date().toISOString();
          nextStep.error = stepErr.message || "Unknown error";

          await admin.from("api_jobs").update({
            steps,
            status: "failed",
            error_message: `Step "${nextStep.name}" failed: ${stepErr.message}`,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);
        }

        processed++;
      } catch (jobErr) {
        console.error(`Error processing job ${job.id}:`, jobErr);
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-api-jobs error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeStep(admin: any, job: any, step: any): Promise<any> {
  const metadata = job.metadata || {};

  switch (step.name) {
    case "register":
      return await stepRegister(admin, job, metadata);
    case "compliance":
      return await stepCompliance(admin, job);
    case "analyzer":
      return await stepAnalyzer(admin, job);
    case "email_report":
      return await stepEmailReport(admin, job, step);
    default:
      throw new Error(`Unknown step: ${step.name}`);
  }
}

async function stepRegister(admin: any, job: any, metadata: any): Promise<any> {
  const domainName = (metadata.domain || "").trim().toLowerCase();
  if (!domainName) throw new Error("Domain name missing in metadata");

  // Check if domain already exists in workspace
  const { data: existing } = await admin
    .from("external_domains")
    .select("id, domain")
    .eq("client_id", job.client_id)
    .eq("domain", domainName)
    .maybeSingle();

  if (existing) {
    return { domain_id: existing.id, domain: existing.domain, reused: true };
  }

  // Validate agent if provided
  let agentId = metadata.agent_id || null;
  if (agentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .eq("client_id", job.client_id)
      .maybeSingle();
    if (!agent) agentId = null;
  }

  const { data: newDomain, error: insertErr } = await admin
    .from("external_domains")
    .insert({
      client_id: job.client_id,
      domain: domainName,
      name: domainName,
      agent_id: agentId,
      status: "pending",
    })
    .select("id, domain")
    .single();

  if (insertErr) throw insertErr;

  return { domain_id: newDomain.id, domain: newDomain.domain, reused: false };
}

async function stepCompliance(admin: any, job: any): Promise<any> {
  const domainId = job.domain_id;
  if (!domainId) {
    // Try to get from register step result
    const steps: any[] = job.steps || [];
    const registerStep = steps.find((s: any) => s.name === "register" && s.status === "completed");
    if (registerStep?.result?.domain_id) {
      // Refresh job with domain_id
      await admin.from("api_jobs").update({ domain_id: registerStep.result.domain_id }).eq("id", job.id);
      job.domain_id = registerStep.result.domain_id;
    } else {
      throw new Error("Domain ID not found. Register step must complete first.");
    }
  }

  // Get domain info
  const { data: domain } = await admin
    .from("external_domains")
    .select("id, domain, agent_id")
    .eq("id", job.domain_id)
    .maybeSingle();

  if (!domain) throw new Error("Domain not found");

  // Create analysis record
  const { data: analysis, error: aErr } = await admin
    .from("external_domain_analysis_history")
    .insert({
      domain_id: domain.id,
      source: "api_pipeline",
      status: "pending",
    })
    .select("id")
    .single();

  if (aErr) throw aErr;

  // Create agent task if agent assigned
  if (domain.agent_id) {
    await admin.from("agent_tasks").insert({
      agent_id: domain.agent_id,
      task_type: "external_domain_analysis",
      target_id: domain.id,
      target_type: "external_domain",
      payload: { analysis_id: analysis.id, domain: domain.domain },
      priority: 5,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  }

  return { analysis_id: analysis.id, domain: domain.domain };
}

async function stepAnalyzer(_admin: any, _job: any): Promise<any> {
  // Placeholder — será implementado quando o módulo analyzer estiver pronto
  return { status: "placeholder", message: "Analyzer step not yet implemented" };
}

async function stepEmailReport(_admin: any, _job: any, _step: any): Promise<any> {
  // Placeholder — será implementado quando o envio de email estiver pronto
  return { status: "placeholder", message: "Email report step not yet implemented" };
}
