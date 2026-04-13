import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLovableEmail, EmailAPIError } from 'npm:@lovable.dev/email-js'

const MAX_RETRIES = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !lovableApiKey) {
    console.error('Missing required environment variables')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check rate-limit state
  const { data: state } = await supabase
    .from('email_send_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (state?.rate_limited_until && new Date(state.rate_limited_until) > new Date()) {
    console.log('Rate limited until', state.rate_limited_until)
    return new Response(JSON.stringify({ skipped: true, reason: 'rate_limited' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const batchSize = state?.batch_size || 10
  const sendDelayMs = state?.send_delay_ms || 200
  const authTtlMinutes = state?.auth_email_ttl_minutes || 15
  const transactionalTtlMinutes = state?.transactional_email_ttl_minutes || 60

  let totalProcessed = 0
  let totalSent = 0
  let totalFailed = 0

  // Process auth_emails first (higher priority), then transactional_emails
  for (const queueName of ['auth_emails', 'transactional_emails']) {
    const ttlMinutes = queueName === 'auth_emails' ? authTtlMinutes : transactionalTtlMinutes

    const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
      queue_name: queueName,
      batch_size: batchSize,
      visibility_timeout: 30,
    })

    if (readError) {
      console.error(`Failed to read from ${queueName}`, readError)
      continue
    }

    if (!messages || messages.length === 0) continue

    for (const msg of messages) {
      totalProcessed++
      const payload = msg.message

      // Check TTL - if message is too old, move to DLQ
      const queuedAt = payload?.queued_at ? new Date(payload.queued_at) : new Date(msg.enqueued_at)
      const ageMinutes = (Date.now() - queuedAt.getTime()) / 60000
      if (ageMinutes > ttlMinutes) {
        console.log('Message expired', { msg_id: msg.msg_id, queue: queueName, ageMinutes })
        await supabase.rpc('move_to_dlq', { source_queue: queueName, message_id: msg.msg_id })
        await supabase.from('email_send_log').insert({
          message_id: payload?.message_id,
          template_name: payload?.label || queueName,
          recipient_email: payload?.to || 'unknown',
          status: 'dlq',
          error_message: `Message expired after ${Math.round(ageMinutes)} minutes (TTL: ${ttlMinutes} min)`,
        })
        totalFailed++
        continue
      }

      // Check max retries
      if (msg.read_ct > MAX_RETRIES) {
        console.log('Message exceeded max retries', { msg_id: msg.msg_id, read_ct: msg.read_ct })
        await supabase.rpc('move_to_dlq', { source_queue: queueName, message_id: msg.msg_id })
        await supabase.from('email_send_log').insert({
          message_id: payload?.message_id,
          template_name: payload?.label || queueName,
          recipient_email: payload?.to || 'unknown',
          status: 'dlq',
          error_message: `Exceeded max retries (${MAX_RETRIES})`,
        })
        totalFailed++
        continue
      }

      // Send the email via Lovable API
      try {
        await sendLovableEmail(payload, {
          apiKey: lovableApiKey,
          idempotencyKey: payload?.idempotency_key || payload?.message_id,
        })

        // Successfully sent - delete from queue and log
        await supabase.rpc('delete_email', { queue_name: queueName, message_id: msg.msg_id })
        await supabase.from('email_send_log').insert({
          message_id: payload?.message_id,
          template_name: payload?.label || queueName,
          recipient_email: payload?.to || 'unknown',
          status: 'sent',
        })
        totalSent++

        // Add delay between sends
        if (sendDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, sendDelayMs))
        }
      } catch (err) {
        if (err instanceof EmailAPIError && err.status === 429) {
          // Rate limited - record the retry-after and stop processing
          const retryAfterSeconds = err.retryAfter || 60
          const rateLimitedUntil = new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
          console.warn('Rate limited', { retryAfter: retryAfterSeconds, rateLimitedUntil })

          await supabase
            .from('email_send_state')
            .update({ rate_limited_until: rateLimitedUntil, updated_at: new Date().toISOString() })
            .eq('id', 1)

          // Don't delete the message - it will become visible again after timeout
          return new Response(JSON.stringify({
            processed: totalProcessed,
            sent: totalSent,
            failed: totalFailed,
            rate_limited: true,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Other errors - log and let the message retry (visibility timeout will make it available again)
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('Failed to send email', {
          msg_id: msg.msg_id,
          error: errorMessage,
          read_ct: msg.read_ct,
        })

        await supabase.from('email_send_log').insert({
          message_id: payload?.message_id,
          template_name: payload?.label || queueName,
          recipient_email: payload?.to || 'unknown',
          status: 'failed',
          error_message: errorMessage,
        })
        totalFailed++
      }
    }
  }

  console.log('Queue processing complete', { processed: totalProcessed, sent: totalSent, failed: totalFailed })

  return new Response(JSON.stringify({
    processed: totalProcessed,
    sent: totalSent,
    failed: totalFailed,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
