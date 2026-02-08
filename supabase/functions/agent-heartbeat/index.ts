import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HeartbeatRequest {
  status: string;
  agent_version: string;
  certificate_thumbprint?: string;
  certificate_public_key?: string;
}

interface UpdateInfo {
  version: string;
  download_url: string;
  checksum: string;
  force: boolean;
}

interface HeartbeatSuccessResponse {
  success: true;
  agent_id: string;
  timestamp: string;
  next_heartbeat_in: number;
  config_flag: 0 | 1;
  has_pending_tasks: boolean;
  update_available: boolean;
  update_info?: UpdateInfo;
  azure_certificate_key_id?: string;
  check_components?: boolean;
  request_certificate?: boolean;
}

interface HeartbeatErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'INTERNAL_ERROR';
}

/**
 * Sanitize certificate thumbprint by removing prefixes, colons, and normalizing format
 * Handles formats like "sha1 Fingerprint=AA:BB:CC:..." or "SHA1:AA:BB:CC:..."
 */
function sanitizeThumbprint(thumbprint: string | null | undefined): string | null {
  if (!thumbprint) return null;
  let clean = thumbprint.trim();
  // Remove OpenSSL prefixes like "sha1 Fingerprint=", "SHA1 Fingerprint=", etc.
  if (clean.includes('=')) {
    clean = clean.split('=').pop() || clean;
  }
  // Remove colons (AA:BB:CC -> AABBCC)
  clean = clean.replace(/:/g, '');
  return clean.toUpperCase().trim();
}

/**
 * Convert hex string to Uint8Array
 */
function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

/**
 * Get encryption key from M365_ENCRYPTION_KEY (64-char hex = 32 bytes)
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex) {
    throw new Error('M365_ENCRYPTION_KEY not configured');
  }
  
  // Convert hex string directly to bytes (no hashing needed)
  const keyBytes = fromHex(keyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

/**
 * Decrypt secret using AES-256-GCM
 * Supports legacy base64 format for backwards compatibility
 */
async function decryptSecret(encrypted: string): Promise<string> {
  // Legacy format (no colon) - try base64
  if (!encrypted.includes(':')) {
    try {
      return atob(encrypted);
    } catch {
      return encrypted;
    }
  }

  // AES-GCM format: iv:ciphertext (hex encoded)
  try {
    const [ivHex, ciphertextHex] = encrypted.split(':');
    const iv = fromHex(ivHex);
    const ciphertext = fromHex(ciphertextHex);
    const key = await getEncryptionKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('AES-GCM decryption failed:', error);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Compare semantic versions (e.g., "1.0.0" vs "1.1.0")
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = b.split('.').map(n => parseInt(n, 10) || 0);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

interface RpcHeartbeatResult {
  success: boolean;
  error?: string;
  agent_id?: string;
  jwt_secret?: string;
  config_flag?: number;
  has_pending_tasks?: boolean;
  next_heartbeat_in?: number;
}

/**
 * Update agent version in database
 */
async function updateAgentVersion(supabase: any, agentId: string, version: string): Promise<void> {
  if (!version || version === '0.0.0' || version === 'unknown') return;
  
  try {
    await supabase
      .from('agents')
      .update({ agent_version: version })
      .eq('id', agentId);
  } catch (error) {
    console.error('Failed to update agent version:', error);
  }
}

/**
 * Upload certificate to Service Principal in CLIENT Tenant using PATCH endpoint
 * This is the correct approach - certificates are registered on the Service Principal
 * using PATCH (not addKey which requires proof JWT)
 * 
 * Flow:
 * 1. Get access token for the CLIENT tenant using app credentials
 * 2. Fetch existing keyCredentials from Service Principal
 * 3. PATCH Service Principal with new certificate appended to existing keys
 */
async function uploadCertificateToServicePrincipal(
  clientTenantId: string,  // Tenant CLIENTE (e.g., TASCHIBRA)
  appId: string,
  spObjectId: string,      // Service Principal Object ID (in client tenant)
  clientSecret: string,
  thumbprint: string,
  publicKey: string,
  agentId: string
): Promise<{ success: boolean; keyId?: string; error?: string }> {
  try {
    console.log(`Uploading certificate to Service Principal ${spObjectId.substring(0, 8)}... in Client Tenant ${clientTenantId.substring(0, 8)}...`);
    
    // Get access token for the CLIENT tenant (NOT home tenant!)
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${clientTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`Failed to get token for Client Tenant ${clientTenantId}:`, errText);
      return { success: false, error: `Token error: ${tokenResponse.status}` };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch existing keyCredentials from Service Principal
    const currentSpResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spObjectId}?$select=keyCredentials`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!currentSpResponse.ok) {
      const errText = await currentSpResponse.text();
      console.error(`Failed to get Service Principal:`, errText);
      return { success: false, error: `GET SP error: ${currentSpResponse.status}` };
    }

    const currentSpData = await currentSpResponse.json();
    const existingKeys = currentSpData.keyCredentials || [];
    
    console.log(`Service Principal has ${existingKeys.length} existing key(s)`);

    // Check if this thumbprint is already registered
    const sanitizedNewThumbprint = sanitizeThumbprint(thumbprint);
    for (const key of existingKeys) {
      const existingThumbprint = sanitizeThumbprint(key.customKeyIdentifier);
      if (existingThumbprint === sanitizedNewThumbprint) {
        console.log(`Certificate with thumbprint ${sanitizedNewThumbprint?.substring(0, 8)}... already registered in Service Principal`);
        return { success: true, keyId: sanitizedNewThumbprint };
      }
    }

    // Format certificate for Azure (base64 without headers)
    const certBase64 = publicKey
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    // Calculate dates (1 year validity - Azure limit)
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Create new key credential
    const newKeyCredential = {
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
      key: certBase64,
      displayName: `iScope-Agent-${agentId.substring(0, 8)}`,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    };

    // PATCH Service Principal with all certificates (existing + new)
    const patchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spObjectId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyCredentials: [...existingKeys, newKeyCredential],
        }),
      }
    );

    if (!patchResponse.ok) {
      const errText = await patchResponse.text();
      console.error(`Failed to PATCH Service Principal:`, errText);
      return { success: false, error: `PATCH error: ${patchResponse.status} - ${errText}` };
    }

    console.log(`Certificate uploaded to Service Principal in Client Tenant, thumbprint: ${sanitizedNewThumbprint?.substring(0, 8)}...`);
    return { success: true, keyId: sanitizedNewThumbprint || thumbprint };
  } catch (error) {
    console.error(`Error uploading certificate to Service Principal:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Upload agent certificate to Azure Service Principal in CLIENT tenant
 * Uses m365_tenant_agents + m365_app_credentials to find linked tenants
 * Returns the thumbprint if successful
 */
async function uploadAgentCertificate(
  supabase: any,
  agentId: string,
  thumbprint: string,
  publicKey: string
): Promise<string | null> {
  console.log(`Uploading certificate for agent ${agentId}, thumbprint: ${thumbprint.substring(0, 8)}...`);
  
  try {
    // Get linked CLIENT tenants for this agent
    const { data: linkedTenants, error: linkError } = await supabase
      .from('m365_tenant_agents')
      .select(`
        tenant_record_id,
        m365_tenants!inner(id, tenant_id, tenant_domain, client_id),
        m365_app_credentials!inner(azure_app_id, sp_object_id, client_secret_encrypted)
      `)
      .eq('agent_id', agentId)
      .eq('enabled', true);

    if (linkError) {
      console.error('Error fetching linked tenants:', linkError);
      return null;
    }

    if (!linkedTenants?.length) {
      console.log('No linked tenants found for agent, skipping certificate upload');
      return null;
    }

    console.log(`Found ${linkedTenants.length} linked tenant(s) for agent ${agentId}`);

    const uploadResults: string[] = [];

    for (const link of linkedTenants) {
      const clientTenantId = link.m365_tenants?.tenant_id;
      const tenantDomain = link.m365_tenants?.tenant_domain;
      const spObjectId = link.m365_app_credentials?.sp_object_id;
      const azureAppId = link.m365_app_credentials?.azure_app_id;
      const encryptedSecret = link.m365_app_credentials?.client_secret_encrypted;

      if (!clientTenantId || !spObjectId || !azureAppId || !encryptedSecret) {
        console.warn(`Missing data for linked tenant:`, { 
          clientTenantId: clientTenantId?.substring(0, 8), 
          spObjectId: spObjectId?.substring(0, 8), 
          azureAppId: azureAppId?.substring(0, 8),
          hasSecret: !!encryptedSecret 
        });
        continue;
      }

      console.log(`Processing tenant ${tenantDomain || clientTenantId.substring(0, 8)}...`);

      // Decrypt client secret
      let clientSecret: string;
      try {
        clientSecret = await decryptSecret(encryptedSecret);
      } catch (decryptError) {
        console.error('Failed to decrypt client secret for tenant:', decryptError);
        continue;
      }

      if (!clientSecret) {
        console.error('Decrypted client secret is empty');
        continue;
      }

      // Upload certificate to Service Principal in CLIENT tenant
      const result = await uploadCertificateToServicePrincipal(
        clientTenantId,       // Tenant CLIENTE (e.g., TASCHIBRA)
        azureAppId,
        spObjectId,           // Service Principal Object ID (in client tenant)
        clientSecret,
        thumbprint,
        publicKey,
        agentId
      );

      if (result.success && result.keyId) {
        uploadResults.push(result.keyId);
        console.log(`Certificate registered in tenant ${tenantDomain || clientTenantId}: ${result.keyId.substring(0, 8)}...`);
      } else {
        console.error(`Failed to upload certificate to tenant ${tenantDomain || clientTenantId}: ${result.error}`);
      }
    }

    // Update agent record with certificate info if at least one upload succeeded
    if (uploadResults.length > 0) {
      const sanitizedThumbprint = sanitizeThumbprint(thumbprint);
      await supabase
        .from('agents')
        .update({
          certificate_thumbprint: sanitizedThumbprint,
          certificate_public_key: publicKey,
          azure_certificate_key_id: uploadResults[0],
        })
        .eq('id', agentId);

      console.log(`Certificate registered for agent ${agentId}: ${uploadResults[0]}`);
      return uploadResults[0];
    }

    console.log(`No successful certificate uploads for agent ${agentId}`);
    return null;
  } catch (error) {
    console.error('Error uploading certificate:', error);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Extract Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente ou inválido', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decode token without verification first to get the agent_id (sub claim)
    let payload: { sub?: string; exp?: number };
    try {
      const [, payloadBase64] = decode(token);
      payload = payloadBase64 as { sub?: string; exp?: number };
    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Token inválido', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = payload.sub;
    if (!agentId) {
      console.log('Token does not contain agent ID (sub claim)');
      return new Response(
        JSON.stringify({ error: 'Token não contém identificação do agent', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration BEFORE RPC call
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call optimized RPC (1 round-trip instead of 3 queries)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('rpc_agent_heartbeat', { p_agent_id: agentId });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = rpcResult as RpcHeartbeatResult;

    // Handle RPC-level errors
    if (!result.success) {
      const errorCode = result.error || 'INTERNAL_ERROR';
      
      if (errorCode === 'AGENT_NOT_FOUND') {
        return new Response(
          JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (errorCode === 'BLOCKED') {
        return new Response(
          JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as HeartbeatErrorResponse),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (errorCode === 'UNREGISTERED') {
        return new Response(
          JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as HeartbeatErrorResponse),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro interno', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token signature using jwt_secret from RPC result
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(result.jwt_secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      await verify(token, cryptoKey);
    } catch (verifyError) {
      // Check if the error is specifically about token expiration
      const errorMessage = String(verifyError);
      if (errorMessage.includes('expired') || errorMessage.includes('exp')) {
        console.log('Token expired during verification:', agentId);
        return new Response(
          JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as HeartbeatErrorResponse),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Token signature verification failed:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Assinatura do token inválida', code: 'INVALID_SIGNATURE' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for logging
    let body: HeartbeatRequest;
    try {
      body = await req.json();
    } catch {
      body = { status: 'unknown', agent_version: 'unknown' };
    }

    const agentVersion = body.agent_version || '0.0.0';

    // Update agent version in database (fire and forget)
    await updateAgentVersion(supabase, agentId, agentVersion);

    // Process certificate upload if provided
    let azureCertificateKeyId: string | null = null;
    let checkComponents = false;
    let requestCertificate = false;
    
    // Fetch agent data (certificate and check_components flag) in a single query
    const { data: agentData } = await supabase
      .from('agents')
      .select('azure_certificate_key_id, check_components, certificate_thumbprint')
      .eq('id', agentId)
      .single();

    checkComponents = agentData?.check_components || false;

    // Sanitize thumbprints for comparison
    const sanitizedInputThumbprint = sanitizeThumbprint(body.certificate_thumbprint);
    const sanitizedAgentThumbprint = sanitizeThumbprint(agentData?.certificate_thumbprint);
    
    if (body.certificate_public_key && sanitizedInputThumbprint) {
      if (!agentData?.azure_certificate_key_id) {
        console.log(`Agent ${agentId} has pending certificate (thumbprint: ${sanitizedInputThumbprint?.substring(0, 8)}...), uploading to Azure...`);
        azureCertificateKeyId = await uploadAgentCertificate(
          supabase,
          agentId,
          sanitizedInputThumbprint, // Use sanitized thumbprint
          body.certificate_public_key
        );
      } else {
        azureCertificateKeyId = agentData.azure_certificate_key_id;
        console.log(`Agent ${agentId} already has certificate registered: ${azureCertificateKeyId}`);
      }
    }
    
    // Check if agent needs to send certificate
    // Case: Agent has linked M365 tenants but hasn't sent certificate yet
    if (!sanitizedInputThumbprint && !agentData?.azure_certificate_key_id) {
      try {
        const { data: linkedTenants } = await supabase
          .from('m365_tenant_agents')
          .select('tenant_record_id')
          .eq('agent_id', agentId)
          .eq('enabled', true)
          .limit(1);

        if (linkedTenants && linkedTenants.length > 0) {
          requestCertificate = true;
          console.log(`Agent ${agentId}: has linked tenants but no certificate, requesting certificate`);
        }
      } catch (err) {
        console.error('Error checking linked tenants for certificate:', err);
      }
    }

    // Reset check_components flag after reading it
    if (checkComponents) {
      await supabase
        .from('agents')
        .update({ check_components: false })
        .eq('id', agentId);
      console.log(`Reset check_components flag for agent ${agentId}`);
    }

    // Check for available updates
    const { data: updateSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['agent_latest_version', 'agent_update_checksum', 'agent_force_update']);

    const latestVersion = (updateSettings?.find(s => s.key === 'agent_latest_version')?.value as string || '1.0.0').replace(/"/g, '');
    const updateChecksum = (updateSettings?.find(s => s.key === 'agent_update_checksum')?.value as string || '').replace(/"/g, '');
    const forceUpdate = updateSettings?.find(s => s.key === 'agent_force_update')?.value === true || 
                        updateSettings?.find(s => s.key === 'agent_force_update')?.value === 'true';

    // Compare versions to determine if update is available
    const updateAvailable = compareVersions(agentVersion, latestVersion) < 0;

    console.log(`Heartbeat OK: agent=${agentId}, version=${agentVersion}, latest=${latestVersion}, update=${updateAvailable}, config_flag=${result.config_flag}, pending=${result.has_pending_tasks}, cert=${azureCertificateKeyId ? 'registered' : 'none'}`);

    // Build success response
    const response: HeartbeatSuccessResponse = {
      success: true,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      next_heartbeat_in: result.next_heartbeat_in || 120,
      config_flag: (result.config_flag || 0) as 0 | 1,
      has_pending_tasks: result.has_pending_tasks || false,
      update_available: updateAvailable,
    };

    // Include certificate key ID if available
    if (azureCertificateKeyId) {
      response.azure_certificate_key_id = azureCertificateKeyId;
    }

    // Include check_components flag if set
    if (checkComponents) {
      response.check_components = true;
    }
    
    // Request certificate re-upload if linked tenants need it
    if (requestCertificate) {
      response.request_certificate = true;
      console.log(`Agent ${agentId}: requesting certificate re-upload for linked tenants`);
    }

    // Include update info if available
    if (updateAvailable) {
      response.update_info = {
        version: latestVersion,
        download_url: `${supabaseUrl}/storage/v1/object/public/agent-releases/iscope-agent-${latestVersion}.tar.gz`,
        checksum: updateChecksum,
        force: forceUpdate,
      };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in agent-heartbeat:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
