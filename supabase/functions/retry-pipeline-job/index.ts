import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
    const userId = claimsData.claims.sub;

    // Check super_admin
    const { data: roleCheck } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), { status: 400, headers });
    }

    // Fetch the job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('api_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers });
    }

    if (job.status !== 'failed') {
      return new Response(JSON.stringify({ error: 'Only failed jobs can be retried' }), { status: 400, headers });
    }

    // Reset failed steps and their dependents
    const steps = (job.steps as any[]) || [];
    let foundFailed = false;
    const updatedSteps = steps.map((step: any) => {
      if (step.status === 'failed') foundFailed = true;
      if (foundFailed && step.status !== 'completed') {
        return {
          ...step,
          status: 'pending',
          error: null,
          started_at: null,
          completed_at: null,
          result: null,
        };
      }
      return step;
    });

    const { error: updateErr } = await supabaseAdmin
      .from('api_jobs')
      .update({
        status: 'queued',
        error_message: null,
        completed_at: null,
        current_step: null,
        steps: updatedSteps,
      })
      .eq('id', job_id);

    if (updateErr) {
      console.error('Update error:', updateErr);
      return new Response(JSON.stringify({ error: 'Failed to retry job' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, job_id }), { status: 200, headers });
  } catch (err) {
    console.error('retry-pipeline-job error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers });
  }
});
