import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Office 365 Exchange Online resource ID
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
// Exchange.ManageAsApp permission ID
const EXCHANGE_MANAGE_AS_APP_ID = "dc50a0fb-09a3-484d-be87-e023b12c6440";

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decryptSecret(encryptedData: string): Promise<string> {
  const encryptionKeyHex = Deno.env.get("M365_ENCRYPTION_KEY");
  if (!encryptionKeyHex) {
    throw new Error("M365_ENCRYPTION_KEY not configured");
  }

  const [ivHex, ciphertextHex] = encryptedData.split(":");
  if (!ivHex || !ciphertextHex) {
    // Not encrypted, return as-is (legacy)
    return encryptedData;
  }

  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ciphertextHex);
  const keyBytes = fromHex(encryptionKeyHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[ensure-exchange-permission] Starting...");

    // Get global M365 config
    const { data: globalConfig, error: configError } = await supabase
      .from("m365_global_config")
      .select("app_id, app_object_id, client_secret_encrypted, home_tenant_id")
      .limit(1)
      .single();

    if (configError || !globalConfig) {
      console.log("[ensure-exchange-permission] No global config found");
      return new Response(
        JSON.stringify({ success: false, error: "Global config not found", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!globalConfig.app_object_id) {
      console.log("[ensure-exchange-permission] No app_object_id configured");
      return new Response(
        JSON.stringify({ success: false, error: "App Object ID not configured", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!globalConfig.home_tenant_id) {
      console.log("[ensure-exchange-permission] No home_tenant_id configured");
      return new Response(
        JSON.stringify({ success: false, error: "Home Tenant ID not configured", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt client secret
    const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted);

    // Get access token for home tenant
    console.log("[ensure-exchange-permission] Getting access token for home tenant...");
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${globalConfig.home_tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: globalConfig.app_id,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[ensure-exchange-permission] Failed to get token:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to get access token", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get current app registration
    console.log("[ensure-exchange-permission] Fetching app registration...");
    const appUrl = `https://graph.microsoft.com/v1.0/applications/${globalConfig.app_object_id}`;
    const appResponse = await fetch(appUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!appResponse.ok) {
      const error = await appResponse.text();
      console.error("[ensure-exchange-permission] Failed to get app registration:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to get app registration", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const app = await appResponse.json();
    const currentPermissions = app.requiredResourceAccess || [];

    // Check if Exchange permission already exists
    const exchangeResource = currentPermissions.find(
      (r: any) => r.resourceAppId === EXCHANGE_RESOURCE_ID
    );

    if (exchangeResource) {
      const hasPermission = exchangeResource.resourceAccess?.some(
        (p: any) => p.id === EXCHANGE_MANAGE_AS_APP_ID
      );

      if (hasPermission) {
        console.log("[ensure-exchange-permission] Exchange.ManageAsApp already configured");
        return new Response(
          JSON.stringify({ success: true, added: false, message: "Already configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add permission to existing resource
      exchangeResource.resourceAccess.push({
        id: EXCHANGE_MANAGE_AS_APP_ID,
        type: "Role",
      });
    } else {
      // Add new resource with permission
      currentPermissions.push({
        resourceAppId: EXCHANGE_RESOURCE_ID,
        resourceAccess: [
          {
            id: EXCHANGE_MANAGE_AS_APP_ID,
            type: "Role",
          },
        ],
      });
    }

    // Update app registration
    console.log("[ensure-exchange-permission] Adding Exchange.ManageAsApp to app registration...");
    const updateResponse = await fetch(appUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requiredResourceAccess: currentPermissions,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error("[ensure-exchange-permission] Failed to update app registration:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update app registration", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ensure-exchange-permission] Exchange.ManageAsApp added successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        added: true,
        message: "Exchange.ManageAsApp added to App Registration",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[ensure-exchange-permission] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal error", skipped: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
