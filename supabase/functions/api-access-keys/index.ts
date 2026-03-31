import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond({ error: "Unauthorized" }, 401);

    // Check super_admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });
    if (!roleCheck) return respond({ error: "Forbidden" }, 403);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // GET — List keys
    if (req.method === "GET" && (!action || action === "list")) {
      const { data: keys, error } = await adminClient
        .from("api_access_keys")
        .select("id, client_id, key_prefix, name, scopes, is_active, expires_at, last_used_at, created_by, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with client names
      const clientIds = [...new Set(keys?.map((k: any) => k.client_id) || [])];
      const { data: clients } = await adminClient
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      const clientMap = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]));

      const enriched = (keys || []).map((k: any) => ({
        ...k,
        client_name: clientMap[k.client_id] || "Desconhecido",
      }));

      return respond({ keys: enriched });
    }

    // GET — List logs
    if (req.method === "GET" && action === "logs") {
      const keyId = url.searchParams.get("key_id");
      let query = adminClient
        .from("api_access_logs")
        .select("id, api_key_id, endpoint, method, status_code, ip_address, response_time_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (keyId) query = query.eq("api_key_id", keyId);

      const { data: logs, error } = await query;
      if (error) throw error;
      return respond({ logs: logs || [] });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();

      // Generate new key
      if (action === "generate") {
        const { name, client_id, scopes, expires_at } = body;
        if (!name?.trim()) return respond({ error: "Nome é obrigatório" }, 400);
        if (!client_id) return respond({ error: "Workspace é obrigatório" }, 400);
        if (!scopes?.length) return respond({ error: "Selecione ao menos um escopo" }, 400);

        const rawToken = `isk_${crypto.randomUUID().replace(/-/g, "")}`;
        const keyHash = await sha256(rawToken);
        const keyPrefix = rawToken.substring(0, 12);

        const { error } = await adminClient.from("api_access_keys").insert({
          client_id,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          name: name.trim(),
          scopes,
          expires_at: expires_at || null,
          created_by: user.id,
        });

        if (error) throw error;
        return respond({ token: rawToken, prefix: keyPrefix, message: "Chave gerada com sucesso" });
      }

      // Revoke key
      if (action === "revoke") {
        const { id } = body;
        if (!id) return respond({ error: "ID é obrigatório" }, 400);
        const { error } = await adminClient
          .from("api_access_keys")
          .update({ is_active: false })
          .eq("id", id);
        if (error) throw error;
        return respond({ message: "Chave revogada com sucesso" });
      }

      // Update key
      if (action === "update") {
        const { id, name, scopes, expires_at } = body;
        if (!id) return respond({ error: "ID é obrigatório" }, 400);
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name.trim();
        if (scopes !== undefined) updates.scopes = scopes;
        if (expires_at !== undefined) updates.expires_at = expires_at || null;

        const { error } = await adminClient
          .from("api_access_keys")
          .update(updates)
          .eq("id", id);
        if (error) throw error;
        return respond({ message: "Chave atualizada com sucesso" });
      }

      return respond({ error: "Ação inválida" }, 400);
    }

    // DELETE
    if (req.method === "DELETE") {
      const body = await req.json();
      const { id } = body;
      if (!id) return respond({ error: "ID é obrigatório" }, 400);
      const { error } = await adminClient
        .from("api_access_keys")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return respond({ message: "Chave excluída permanentemente" });
    }

    return respond({ error: "Método não suportado" }, 405);
  } catch (err) {
    console.error("api-access-keys error:", err);
    return respond({ error: err.message || "Erro interno" }, 500);
  }
});
