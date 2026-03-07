import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    let loggedOutCount = 0
    let page = 1
    const perPage = 100

    while (true) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (listError) throw listError
      if (!users || users.length === 0) break

      for (const u of users) {
        try {
          await supabaseAdmin.auth.admin.signOut(u.id, 'global')
          loggedOutCount++
        } catch (e) {
          console.error(`Failed to logout user ${u.id}:`, e)
        }
      }

      if (users.length < perPage) break
      page++
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${loggedOutCount} sessões encerradas`,
        loggedOutCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Force logout error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
