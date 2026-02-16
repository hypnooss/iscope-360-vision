import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decryptSecret(encryptedData: string): Promise<string> {
  const encryptionKeyHex = Deno.env.get("M365_ENCRYPTION_KEY");
  if (!encryptionKeyHex) throw new Error("M365_ENCRYPTION_KEY not configured");

  const [ivHex, ciphertextHex] = encryptedData.split(":");
  if (!ivHex || !ciphertextHex) return encryptedData;

  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ciphertextHex);
  const keyBytes = fromHex(encryptionKeyHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

async function getApiKey(supabase: any): Promise<string | null> {
  // Try system_settings first
  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("key", "api_key_DEHASHED_API_KEY");

  if (settings && settings.length > 0) {
    const s = settings[0];
    const cleanVal = typeof s.value === "string"
      ? s.value.replace(/^"|"$/g, "")
      : JSON.stringify(s.value).replace(/^"|"$/g, "");
    try {
      return await decryptSecret(cleanVal);
    } catch {
      return cleanVal;
    }
  }

  // Fallback to env var
  return Deno.env.get("DEHASHED_API_KEY") || null;
}

function maskPassword(password: string | null): string {
  if (!password) return "";
  if (password.length <= 3) return "***";
  return password.substring(0, 3) + "*".repeat(Math.min(password.length - 3, 8));
}

function maskHash(hash: string | null): string {
  if (!hash) return "";
  if (hash.startsWith("$2")) return `bcrypt: ${hash.substring(0, 12)}...`;
  if (hash.startsWith("$1")) return `md5crypt: ${hash.substring(0, 12)}...`;
  if (hash.startsWith("$5")) return `sha256crypt: ${hash.substring(0, 12)}...`;
  if (hash.startsWith("$6")) return `sha512crypt: ${hash.substring(0, 12)}...`;
  if (hash.length === 32) return `md5: ${hash.substring(0, 8)}...`;
  if (hash.length === 40) return `sha1: ${hash.substring(0, 8)}...`;
  if (hash.length === 64) return `sha256: ${hash.substring(0, 8)}...`;
  return hash.length > 12 ? `${hash.substring(0, 8)}...` : hash;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "super_suporte"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta ação" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { domain, client_id, force_refresh } = await req.json();

    if (!domain || !client_id) {
      return new Response(JSON.stringify({ error: "domain e client_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check cache first (unless force_refresh)
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("dehashed_cache")
        .select("*")
        .eq("client_id", client_id)
        .eq("domain", domain)
        .order("queried_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const cacheAge = Date.now() - new Date(cached.queried_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (cacheAge < sevenDays) {
          return new Response(JSON.stringify({
            success: true,
            source: "cache",
            data: cached,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Get API key
    const apiKey = await getApiKey(supabase);
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "API key do DeHashed não configurada",
        code: "NO_API_KEY",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call DeHashed API v2
    const searchUrl = "https://api.dehashed.com/v2/search";

    console.log(`[dehashed-search] Querying domain: ${domain}`);

    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DeHashed-Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: `domain:${domain}`,
        page: 1,
        size: 10000,
        wildcard: false,
        regex: false,
        de_dupe: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[dehashed-search] API error ${response.status}: ${errorText}`);
      return new Response(JSON.stringify({
        error: `DeHashed API retornou erro ${response.status}`,
        details: errorText,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiData = await response.json();
    const entries = apiData.entries || [];
    const totalEntries = apiData.total || entries.length;

    // Process entries - mask sensitive data
    const processedEntries = entries.map((entry: any) => ({
      email: entry.email || "",
      username: entry.username || "",
      password: maskPassword(entry.password),
      password_raw: entry.password || "",
      hashed_password: maskHash(entry.hashed_password),
      hashed_password_raw: entry.hashed_password || "",
      database_name: entry.database_name || "",
      ip_address: entry.ip_address || "",
      name: entry.name || "",
      phone: entry.phone || "",
    }));

    // Extract unique databases
    const dbSet = new Set<string>();
    for (const e of processedEntries) {
      if (e.database_name) dbSet.add(e.database_name);
    }
    const uniqueDatabases = Array.from(dbSet);

    // Save to cache
    const { data: cacheRecord, error: cacheError } = await supabase
      .from("dehashed_cache")
      .upsert({
        client_id,
        domain,
        total_entries: totalEntries,
        entries: processedEntries,
        databases: uniqueDatabases,
        queried_at: new Date().toISOString(),
      }, {
        onConflict: "client_id,domain",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    // If upsert fails due to no unique constraint, just insert
    if (cacheError) {
      console.log("[dehashed-search] Upsert failed, doing insert:", cacheError.message);
      // Delete old cache for this domain/client
      await supabase
        .from("dehashed_cache")
        .delete()
        .eq("client_id", client_id)
        .eq("domain", domain);

      await supabase
        .from("dehashed_cache")
        .insert({
          client_id,
          domain,
          total_entries: totalEntries,
          entries: processedEntries,
          databases: uniqueDatabases,
          queried_at: new Date().toISOString(),
        });
    }

    // Audit log
    await supabase.from("admin_activity_logs").insert({
      admin_id: user.id,
      action: "dehashed_search",
      action_type: "scan",
      target_type: "domain",
      target_id: client_id,
      target_name: domain,
      details: { domain, total_entries: totalEntries, databases_count: uniqueDatabases.length },
    });

    console.log(`[dehashed-search] Found ${totalEntries} entries for ${domain}`);

    return new Response(JSON.stringify({
      success: true,
      source: "api",
      data: {
        client_id,
        domain,
        total_entries: totalEntries,
        entries: processedEntries,
        databases: uniqueDatabases,
        queried_at: new Date().toISOString(),
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[dehashed-search] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
