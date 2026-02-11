import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateNextRunAt(
  frequency: string,
  hour: number,
  dayOfWeek: number,
  dayOfMonth: number
): string {
  const now = new Date();
  let next: Date;

  if (frequency === 'daily') {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'weekly') {
    const currentDay = now.getUTCDay();
    let daysAhead = dayOfWeek - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead, hour, 0, 0));
  } else {
    // monthly
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, hour, 0, 0));
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[run-scheduled-analyses] Starting scheduled analysis check...');

    // Find active schedules that are due
    const { data: dueSchedules, error: fetchError } = await supabase
      .from('analysis_schedules')
      .select('id, firewall_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .lte('next_run_at', new Date().toISOString());

    if (fetchError) {
      console.error('[run-scheduled-analyses] Error fetching schedules:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('[run-scheduled-analyses] No schedules due for execution.');
      return new Response(
        JSON.stringify({ success: true, triggered: 0, message: 'No schedules due' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[run-scheduled-analyses] Found ${dueSchedules.length} schedule(s) due for execution.`);

    let triggered = 0;
    let errors = 0;

    for (const schedule of dueSchedules) {
      try {
        // Call trigger-firewall-analysis
        const triggerUrl = `${supabaseUrl}/functions/v1/trigger-firewall-analysis`;
        const response = await fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ firewall_id: schedule.firewall_id }),
        });

        const result = await response.json();

        if (result.success || response.status === 409) {
          // 409 = already has a pending task, that's ok
          console.log(`[run-scheduled-analyses] Triggered firewall ${schedule.firewall_id}: ${result.message || 'success'}`);
          triggered++;
        } else {
          console.error(`[run-scheduled-analyses] Failed to trigger firewall ${schedule.firewall_id}:`, result.error);
          errors++;
        }

        // Calculate and update next_run_at regardless of trigger result
        const nextRunAt = calculateNextRunAt(
          schedule.frequency,
          schedule.scheduled_hour ?? 0,
          schedule.scheduled_day_of_week ?? 1,
          schedule.scheduled_day_of_month ?? 1
        );

        await supabase
          .from('analysis_schedules')
          .update({ next_run_at: nextRunAt })
          .eq('id', schedule.id);

        console.log(`[run-scheduled-analyses] Updated next_run_at for schedule ${schedule.id}: ${nextRunAt}`);
      } catch (err) {
        console.error(`[run-scheduled-analyses] Error processing schedule ${schedule.id}:`, err);
        errors++;
      }
    }

    console.log(`[run-scheduled-analyses] Done. Triggered: ${triggered}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, triggered, errors, total: dueSchedules.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[run-scheduled-analyses] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
