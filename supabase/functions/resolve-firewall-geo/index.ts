import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isPrivateIP = (ip: string): boolean =>
  /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);

const looksLikeIP = (s: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

async function fetchWithoutSSLVerification(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  // @ts-ignore - Deno-specific API
  const client = Deno.createHttpClient({
    // @ts-ignore - true ignora todos os erros de certificado (necessário para FortiGates com cert auto-assinado)
    dangerouslyIgnoreCertificateErrors: true,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      // @ts-ignore - Deno permite passar client
      client,
    });
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

async function fortigateRequest(baseUrl: string, apiKey: string, endpoint: string) {
  const url = `${baseUrl}/api/v2${endpoint}`;
  console.log(`resolve-firewall-geo: Fetching ${url}`);

  const response = await fetchWithoutSSLVerification(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FortiGate API error: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function getPublicWanIPs(baseUrl: string, apiKey: string): Promise<{ ip: string; interfaceName: string }[]> {
  // WAN name patterns (same as fortigate-compliance)
  const wanNamePatterns = /^(wan|wan\d+|internet|isp|isp\d+|mpls|lte|4g|5g|broadband)/i;

  // Fetch interfaces and SD-WAN config in parallel
  const [interfacesData, sdwanData] = await Promise.all([
    fortigateRequest(baseUrl, apiKey, "/cmdb/system/interface"),
    fortigateRequest(baseUrl, apiKey, "/cmdb/system/sdwan").catch(() => ({ results: {} })),
  ]);

  const interfaces: any[] = interfacesData.results || [];
  const sdwan = sdwanData.results || {};
  const sdwanMembers = new Set<string>(
    (sdwan.members || []).map((m: any) => m.interface).filter(Boolean)
  );

  // Identify WAN interfaces by priority (same logic as fortigate-compliance)
  const wanInterfaces: { name: string; ip: string }[] = [];

  for (const iface of interfaces) {
    let isWan = false;

    if (iface.name === "virtual-wan-link") {
      isWan = true;
    } else if (sdwanMembers.has(iface.name)) {
      isWan = true;
    } else if (iface.role && iface.role.toLowerCase() === "wan") {
      isWan = true;
    } else if (wanNamePatterns.test(iface.name)) {
      isWan = true;
    }

    if (!isWan) continue;

    // Extract IP from interface (ip field is like "1.2.3.4 255.255.255.0")
    const ipField: string = iface.ip || "";
    const ip = ipField.split(" ")[0];

    if (looksLikeIP(ip) && !isPrivateIP(ip) && ip !== "0.0.0.0") {
      wanInterfaces.push({ name: iface.name, ip });
    }
  }

  return wanInterfaces.map(w => ({ ip: w.ip, interfaceName: w.name }));
}

interface GeoData {
  lat: number;
  lng: number;
  country: string;
  country_code: string;
  region: string;
  city: string;
}

async function geolocateIP(ip: string): Promise<GeoData | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !json.latitude || !json.longitude) return null;
    return {
      lat: json.latitude as number,
      lng: json.longitude as number,
      country: json.country_name || "",
      country_code: (json.country_code || "").toLowerCase(),
      region: json.region || "",
      city: json.city || "",
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, api_key } = await req.json();

    if (!url || !api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_params", message: "url e api_key são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize URL (remove trailing slash)
    const baseUrl = url.replace(/\/$/, "");

    let wanIPs: { ip: string; interfaceName: string }[] = [];

    try {
      wanIPs = await getPublicWanIPs(baseUrl, api_key);
    } catch (err: any) {
      console.error("resolve-firewall-geo: FortiGate API error:", err.message);

      const isAuthError = err.message?.includes("401") || err.message?.includes("403");
      const errorCode = isAuthError ? "auth_failed" : "connection_failed";
      const errorMsg = isAuthError
        ? "Autenticação falhou — verifique a API Key"
        : "Não foi possível conectar ao FortiGate — verifique a URL e a conectividade";

      return new Response(
        JSON.stringify({ success: false, error: errorCode, message: errorMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (wanIPs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_public_ip",
          message: "Nenhum IP público encontrado nas interfaces WAN do FortiGate",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geolocate all IPs in parallel
    const geoResults = await Promise.all(
      wanIPs.map(async (w) => {
        const geo = await geolocateIP(w.ip);
        return geo ? { ip: w.ip, interface: w.interfaceName, ...geo } : null;
      })
    );

    const candidates = geoResults.filter(Boolean) as Array<{
      ip: string;
      interface: string;
      lat: number;
      lng: number;
      country: string;
      country_code: string;
      region: string;
      city: string;
    }>;

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "geo_failed",
          message: `IPs WAN encontrados (${wanIPs.map(w => w.ip).join(", ")}) mas não foi possível geolocalizar nenhum`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single IP: return directly (no dialog needed)
    if (candidates.length === 1) {
      const c = candidates[0];
      return new Response(
        JSON.stringify({
          success: true,
          multiple: false,
          lat: c.lat,
          lng: c.lng,
          ip: c.ip,
          interface: c.interface,
          country: c.country,
          country_code: c.country_code,
          region: c.region,
          city: c.city,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multiple IPs: return all candidates for user selection
    return new Response(
      JSON.stringify({
        success: true,
        multiple: true,
        candidates,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("resolve-firewall-geo: Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
