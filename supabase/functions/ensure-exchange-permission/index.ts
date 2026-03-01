import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Office 365 Exchange Online
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
const EXCHANGE_MANAGE_AS_APP_ID = "dc50a0fb-09a3-484d-be87-e023b12c6440";

// SharePoint Online
const SHAREPOINT_RESOURCE_ID = "00000003-0000-0ff1-ce00-000000000000";
const SHAREPOINT_SITES_FULLCONTROL_ID = "678536fe-1083-478a-9c59-b99265e6b0d3";

// Microsoft Graph
const GRAPH_RESOURCE_ID = "00000003-0000-0000-c000-000000000000";
const IDENTITY_RISKY_USER_READ_ALL_ID = "dc5007c0-2d7d-4c42-879c-2dab87571379";

// Intune / Device Management
const DEVICE_MGMT_MANAGED_DEVICES_READ_ALL_ID = "e4c9e354-4dc5-45b8-9e7c-e1393b0b1a20";
const DEVICE_MGMT_CONFIGURATION_READ_ALL_ID = "dc377aa6-52d8-4e23-b271-b3b7f5e4f6c4";

// Security / Defender
const SECURITY_ALERT_READ_ALL_ID = "472e4a40-bb78-4d68-a2bb-8ac1c8de0c8c";
const SECURITY_EVENTS_READ_ALL_ID = "bf394140-e372-4bf9-a898-299cfc7564e5";
const AUDIT_LOG_READ_ALL_ID = "b0afded3-3588-46d8-8b3d-9842eff778da";
const SECURITY_INCIDENT_READ_ALL_ID = "45cc0394-e837-488b-a098-1c7ce2c0e0b5";
const INFORMATION_PROTECTION_POLICY_READ_ALL_ID = "19da66cb-0fb0-49a4-b7a2-3607ae4e9acf";
const ATTACK_SIMULATION_READ_ALL_ID = "93283d0a-6322-4fa8-966b-813c78c0e1b4";

// Teams
const TEAM_SETTINGS_READ_ALL_ID = "242607bd-1d2c-432c-82eb-bdb27baa23ab";
const CHANNEL_READ_BASIC_ALL_ID = "59a6b24b-4225-4393-a6be-42ed3eab75c4";
const TEAM_MEMBER_READ_ALL_ID = "660b7406-55f1-41ca-a0ed-0b035e182f3e";

// SharePoint Admin
const SHAREPOINT_TENANT_SETTINGS_READ_ALL_ID = "83d4163d-a2d8-4e3b-b3a5-5d4b1a5e5f6e";

const REQUIRED_PERMISSIONS = [
  { resourceAppId: EXCHANGE_RESOURCE_ID, permissionId: EXCHANGE_MANAGE_AS_APP_ID, name: "Exchange.ManageAsApp" },
  { resourceAppId: SHAREPOINT_RESOURCE_ID, permissionId: SHAREPOINT_SITES_FULLCONTROL_ID, name: "Sites.FullControl.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: IDENTITY_RISKY_USER_READ_ALL_ID, name: "IdentityRiskyUser.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: DEVICE_MGMT_MANAGED_DEVICES_READ_ALL_ID, name: "DeviceManagementManagedDevices.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: DEVICE_MGMT_CONFIGURATION_READ_ALL_ID, name: "DeviceManagementConfiguration.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: SECURITY_ALERT_READ_ALL_ID, name: "SecurityAlert.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: SECURITY_EVENTS_READ_ALL_ID, name: "SecurityEvents.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: AUDIT_LOG_READ_ALL_ID, name: "AuditLog.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: SECURITY_INCIDENT_READ_ALL_ID, name: "SecurityIncident.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: INFORMATION_PROTECTION_POLICY_READ_ALL_ID, name: "InformationProtectionPolicy.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: ATTACK_SIMULATION_READ_ALL_ID, name: "AttackSimulation.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: TEAM_SETTINGS_READ_ALL_ID, name: "TeamSettings.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: CHANNEL_READ_BASIC_ALL_ID, name: "Channel.ReadBasic.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: TEAM_MEMBER_READ_ALL_ID, name: "TeamMember.Read.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: SHAREPOINT_TENANT_SETTINGS_READ_ALL_ID, name: "SharePointTenantSettings.Read.All" },
];

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

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[ensure-exchange-permission] Starting...");

    // 1. Read global config
    const { data: globalConfig, error: configError } = await supabase
      .from("m365_global_config")
      .select("id, app_id, client_secret_encrypted, home_tenant_id, validation_tenant_id")
      .limit(1)
      .single();

    if (configError || !globalConfig) {
      console.log("[ensure-exchange-permission] No global config found");
      return jsonResponse({ success: false, error: "Global config not found", skipped: true });
    }

    const tenantForToken = globalConfig.home_tenant_id || globalConfig.validation_tenant_id;
    if (!tenantForToken) {
      return jsonResponse({ success: false, error: "Tenant ID not configured", skipped: true });
    }

    // 2. Get access token for HOME tenant
    const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted);
    console.log("[ensure-exchange-permission] Getting token for home tenant:", tenantForToken);

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantForToken}/oauth2/v2.0/token`,
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
      console.error("[ensure-exchange-permission] Token error:", error);
      return jsonResponse({ success: false, error: "Failed to get access token", skipped: true });
    }

    const { access_token: accessToken } = await tokenResponse.json();

    // 3. Auto-discover Object ID via appId filter (single call returns id + manifest)
    console.log("[ensure-exchange-permission] Auto-discovering Object ID for appId:", globalConfig.app_id);
    const discoveryUrl = `https://graph.microsoft.com/v1.0/applications(appId='${globalConfig.app_id}')?$select=id,requiredResourceAccess`;

    const discoveryResponse = await fetch(discoveryUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!discoveryResponse.ok) {
      const error = await discoveryResponse.text();
      console.error("[ensure-exchange-permission] Auto-discovery failed:", error);
      return jsonResponse({ success: false, error: "Failed to discover app registration", skipped: true });
    }

    const appData = await discoveryResponse.json();
    const objectId = appData.id;
    const currentPermissions = appData.requiredResourceAccess || [];

    console.log("[ensure-exchange-permission] Discovered Object ID:", objectId);

    // 4. Save discovered Object ID back to config
    await supabase
      .from("m365_global_config")
      .update({ app_object_id: objectId })
      .eq("id", globalConfig.id);

    // 5. Check and add missing permissions
    const addedPermissions: string[] = [];

    for (const perm of REQUIRED_PERMISSIONS) {
      let resource = currentPermissions.find((r: any) => r.resourceAppId === perm.resourceAppId);

      if (!resource) {
        resource = { resourceAppId: perm.resourceAppId, resourceAccess: [] };
        currentPermissions.push(resource);
      }

      const hasPermission = resource.resourceAccess?.some((p: any) => p.id === perm.permissionId);

      if (!hasPermission) {
        resource.resourceAccess.push({ id: perm.permissionId, type: "Role" });
        addedPermissions.push(perm.name);
        console.log(`[ensure-exchange-permission] Adding ${perm.name}`);
      } else {
        console.log(`[ensure-exchange-permission] ${perm.name} already configured`);
      }
    }

    if (addedPermissions.length === 0) {
      console.log("[ensure-exchange-permission] All permissions already configured");
      return jsonResponse({ success: true, added: false, message: "All permissions already configured", permissions: [], objectId });
    }

    // 6. PATCH manifest with discovered Object ID
    console.log(`[ensure-exchange-permission] Patching manifest for ${objectId}...`);
    const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/applications/${objectId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requiredResourceAccess: currentPermissions }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error("[ensure-exchange-permission] PATCH failed:", error);
      return jsonResponse({ success: false, error: "Failed to update app registration", skipped: true });
    }

    console.log(`[ensure-exchange-permission] Success: ${addedPermissions.join(", ")}`);
    return jsonResponse({
      success: true,
      added: true,
      message: `Added permissions: ${addedPermissions.join(", ")}`,
      permissions: addedPermissions,
      objectId,
    });

  } catch (error: any) {
    console.error("[ensure-exchange-permission] Error:", error);
    return jsonResponse({ success: false, error: error.message || "Internal error", skipped: true });
  }
});
