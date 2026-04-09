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

        // Find next actionable step: pending with deps met, OR running (needs polling)
        const runningStep = steps.find((s: any) => s.status === "running");

        if (runningStep) {
          // Poll for completion of async steps
          const pollResult = await pollRunningStep(admin, job, runningStep);
          if (pollResult === "completed" || pollResult === "failed") {
            await admin.from("api_jobs").update({ steps }).eq("id", job.id);
            if (pollResult === "failed") {
              await admin.from("api_jobs").update({
                status: "failed",
                error_message: `Step "${runningStep.name}" failed: ${runningStep.error || "Unknown"}`,
                completed_at: new Date().toISOString(),
              }).eq("id", job.id);
            }
          }
          // If still running, do nothing — cron retries later
          processed++;
          continue;
        }

        const nextStep = steps.find((s: any) => {
          if (s.status !== "pending") return false;
          if (!s.depends_on) return true;
          const dep = steps.find((d: any) => d.name === s.depends_on);
          return dep && dep.status === "completed";
        });

        if (!nextStep) {
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

        // Execute step (kick off async work)
        try {
          const result = await executeStep(admin, job, nextStep);

          // Some steps are async (compliance, analyzer) — they stay "running"
          // Others are sync (register, email_report) — they complete immediately
          if (result?._async) {
            // Step stays running, result metadata saved for polling
            nextStep.result = result;
            await admin.from("api_jobs").update({ steps }).eq("id", job.id);
          } else {
            // Check if the sync step reported an internal failure
            const stepFailed = result?.status === "email_failed" || result?.status === "email_error";
            nextStep.status = stepFailed ? "failed" : "completed";
            nextStep.completed_at = new Date().toISOString();
            nextStep.result = result;
            if (stepFailed) {
              nextStep.error = result?.error || "Step reported failure";
            }

            if (nextStep.name === "register" && result?.domain_id) {
              await admin.from("api_jobs").update({
                steps,
                domain_id: result.domain_id,
              }).eq("id", job.id);
            } else {
              await admin.from("api_jobs").update({ steps }).eq("id", job.id);
            }
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

// ── Polling for async steps ─────────────────────────────────────────────────

async function pollRunningStep(admin: any, job: any, step: any): Promise<"completed" | "failed" | "still_running"> {
  switch (step.name) {
    case "compliance":
      return await pollCompliance(admin, job, step);
    case "analyzer":
      return await pollAnalyzer(admin, job, step);
    default:
      return "still_running";
  }
}

async function pollCompliance(admin: any, job: any, step: any): Promise<"completed" | "failed" | "still_running"> {
  const domainId = job.domain_id || step.result?.domain_id;
  if (!domainId) {
    step.status = "failed";
    step.error = "No domain_id for compliance polling";
    step.completed_at = new Date().toISOString();
    return "failed";
  }

  // Check if the analysis created by this step has completed
  const analysisId = step.result?.analysis_id;
  if (analysisId) {
    const { data: analysis } = await admin
      .from("external_domain_analysis_history")
      .select("id, status, score, report_data")
      .eq("id", analysisId)
      .maybeSingle();

    if (analysis?.status === "completed") {
      step.status = "completed";
      step.completed_at = new Date().toISOString();
      step.result = { ...step.result, score: analysis.score, status: "completed" };
      return "completed";
    }
    if (analysis?.status === "failed") {
      step.status = "failed";
      step.completed_at = new Date().toISOString();
      step.error = "Domain analysis failed";
      return "failed";
    }
  } else {
    // Fallback: check latest completed analysis for this domain created after step started
    const { data: latest } = await admin
      .from("external_domain_analysis_history")
      .select("id, status, score")
      .eq("domain_id", domainId)
      .eq("status", "completed")
      .gte("created_at", step.started_at || "2000-01-01")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      // Also update the original pipeline record if it exists
      if (analysisId && latest.id !== analysisId) {
        await admin
          .from("external_domain_analysis_history")
          .update({ status: "completed", score: latest.score, completed_at: new Date().toISOString() })
          .eq("id", analysisId);
      }
      step.status = "completed";
      step.completed_at = new Date().toISOString();
      step.result = { analysis_id: latest.id, score: latest.score, status: "completed" };
      return "completed";
    }
  }

  // Check timeout (2 hours)
  const startedAt = new Date(step.started_at).getTime();
  if (Date.now() - startedAt > 2 * 60 * 60 * 1000) {
    step.status = "failed";
    step.completed_at = new Date().toISOString();
    step.error = "Compliance step timed out (2h)";
    return "failed";
  }

  return "still_running";
}

async function pollAnalyzer(admin: any, job: any, step: any): Promise<"completed" | "failed" | "still_running"> {
  const snapshotId = step.result?.snapshot_id;
  if (!snapshotId) {
    step.status = "failed";
    step.error = "No snapshot_id for analyzer polling";
    step.completed_at = new Date().toISOString();
    return "failed";
  }

  const { data: snapshot } = await admin
    .from("attack_surface_snapshots")
    .select("id, status, summary, score, results")
    .eq("id", snapshotId)
    .maybeSingle();

  if (snapshot?.status === "completed") {
    step.status = "completed";
    step.completed_at = new Date().toISOString();
    step.result = {
      ...step.result,
      status: "completed",
      score: snapshot.score,
      summary: snapshot.summary,
    };
    return "completed";
  }
  if (snapshot?.status === "failed") {
    step.status = "failed";
    step.completed_at = new Date().toISOString();
    step.error = "Attack surface scan failed";
    return "failed";
  }

  // Timeout (2 hours)
  const startedAt = new Date(step.started_at).getTime();
  if (Date.now() - startedAt > 2 * 60 * 60 * 1000) {
    step.status = "failed";
    step.completed_at = new Date().toISOString();
    step.error = "Analyzer step timed out (2h)";
    return "failed";
  }

  return "still_running";
}

// ── Step execution ──────────────────────────────────────────────────────────

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

// ── Register step (sync) ────────────────────────────────────────────────────

async function stepRegister(admin: any, job: any, metadata: any): Promise<any> {
  const domainName = (metadata.domain || "").trim().toLowerCase();
  if (!domainName) throw new Error("Domain name missing in metadata");

  const { data: existing } = await admin
    .from("external_domains")
    .select("id, domain")
    .eq("client_id", job.client_id)
    .eq("domain", domainName)
    .maybeSingle();

  if (existing) {
    return { domain_id: existing.id, domain: existing.domain, reused: true };
  }

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

// ── Compliance step (async — kicks off agent task, returns _async) ───────────

async function stepCompliance(admin: any, job: any): Promise<any> {
  const domainId = job.domain_id;
  if (!domainId) {
    const steps: any[] = job.steps || [];
    const registerStep = steps.find((s: any) => s.name === "register" && s.status === "completed");
    if (registerStep?.result?.domain_id) {
      await admin.from("api_jobs").update({ domain_id: registerStep.result.domain_id }).eq("id", job.id);
      job.domain_id = registerStep.result.domain_id;
    } else {
      throw new Error("Domain ID not found. Register step must complete first.");
    }
  }

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

  // Return _async flag — step stays "running", polling will check analysis status
  return {
    _async: true,
    analysis_id: analysis.id,
    domain: domain.domain,
    domain_id: domain.id,
  };
}

// ── Analyzer step (async — triggers scoped attack surface scan) ─────────────

async function stepAnalyzer(admin: any, job: any): Promise<any> {
  const domainId = job.domain_id;
  if (!domainId) throw new Error("Domain ID not found for analyzer step");

  const { data: domain } = await admin
    .from("external_domains")
    .select("id, domain, client_id")
    .eq("id", domainId)
    .maybeSingle();

  if (!domain) throw new Error("Domain not found for analyzer");

  // Call run-attack-surface-queue with domain_id to scope scan to this domain only
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/run-attack-surface-queue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      client_id: domain.client_id,
      domain_id: domainId,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Attack surface queue failed: ${errText}`);
  }

  const result = await response.json();

  if (!result.success || result.snapshots_created === 0) {
    // No IPs found for this domain — complete with empty result
    return {
      status: "no_ips",
      message: "No public IPs found for this domain",
      snapshots_created: 0,
    };
  }

  // Get the snapshot ID that was just created for polling
  const { data: snapshot } = await admin
    .from("attack_surface_snapshots")
    .select("id")
    .eq("client_id", domain.client_id)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    _async: true,
    snapshot_id: snapshot?.id || null,
    tasks_created: result.tasks_created,
  };
}

// ── Email Report step (sync — sends report email) ───────────────────────────

async function stepEmailReport(admin: any, job: any, step: any): Promise<any> {
  const domainId = job.domain_id;
  if (!domainId) throw new Error("Domain ID not found for email report");

  const metadata = job.metadata || {};
  const emailTo = metadata.email_to || step.params?.to;
  if (!emailTo) throw new Error("No email recipient specified (email_to)");

  // Fetch domain info
  const { data: domain } = await admin
    .from("external_domains")
    .select("id, domain")
    .eq("id", domainId)
    .maybeSingle();

  if (!domain) throw new Error("Domain not found for email report");

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

  // Build report summary
  const complianceScore = analysis?.score ?? "N/A";
  const attackSurfaceScore = snapshot?.score ?? "N/A";
  const attackSummary = snapshot?.summary || {};

  // Count findings by severity from compliance report
  let critical = 0, high = 0, medium = 0, low = 0;
  if (analysis?.report_data?.categories) {
    const categories = analysis.report_data.categories;
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

  // Try to send via transactional email if available
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: "domain-security-report",
        recipientEmail: emailTo,
        idempotencyKey: `pipeline-report-${job.id}`,
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
        },
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error(`Email send failed: ${errBody}`);
      // Don't fail the entire step — report was generated, just email failed
      return {
        status: "email_failed",
        error: errBody,
        report: { complianceScore, attackSurfaceScore, findings: { critical, high, medium, low } },
      };
    }

    const emailResult = await emailResponse.json();
    return {
      status: "sent",
      email_to: emailTo,
      report: { complianceScore, attackSurfaceScore, findings: { critical, high, medium, low } },
      email_result: emailResult,
    };
  } catch (emailErr: any) {
    console.error("Email report error:", emailErr);
    return {
      status: "email_error",
      error: emailErr.message,
      report: { complianceScore, attackSurfaceScore, findings: { critical, high, medium, low } },
    };
  }
}
