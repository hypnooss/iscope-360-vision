
# Fix: SSL Certificate Bypass na Edge Function `resolve-firewall-geo`

## Diagnóstico

O log da Edge Function revela o problema exato:

```
resolve-firewall-geo: FortiGate API error: error sending request for url
(https://br-lrv-fw-001.gdmseeds.com:3443/api/v2/cmdb/system/interface):
client error (Connect): invalid peer certificate: UnknownIssuer
```

O `fetchWithoutSSLVerification` está falhando porque o `Deno.createHttpClient` com `dangerouslyIgnoreCertificateErrors` **não está funcionando corretamente nessa versão do runtime Deno da Supabase**. Como a chamada falha com exceção, o catch retorna `connection_failed`, e o frontend cai no fallback DNS — que resolve o hostname e aplica a localização direto, sem mostrar o dialog de seleção.

A Edge Function `fortigate-compliance` já tem uma solução funcionando para o mesmo problema. Vamos verificar e aplicar o mesmo padrão.

## Causa raiz

A Edge Function irmã `fortigate-compliance` usa exatamente o mesmo padrão de SSL bypass e funciona com esse FortiGate. Isso sugere que a implementação em `resolve-firewall-geo` tem uma diferença sutil. Analisando os logs da `fortigate-compliance`:

A diferença pode ser o timeout (`AbortSignal.timeout`) sendo aplicado junto com o `client` customizado — em algumas versões do Deno runtime da Supabase, o `AbortSignal.timeout` interfere com o `Deno.createHttpClient`. A solução é usar `setTimeout` + `AbortController` manualmente, **exatamente como a `fortigate-compliance` já faz**.

## Solução

### 1 — Corrigir `supabase/functions/resolve-firewall-geo/index.ts`

Substituir `AbortSignal.timeout(10000)` por `AbortController` + `setTimeout` no `fetchWithoutSSLVerification`, alinhando com o padrão da `fortigate-compliance`.

**Antes:**
```ts
async function fetchWithoutSSLVerification(url: string, options: RequestInit): Promise<Response> {
  const { hostname } = new URL(url);
  const client = Deno.createHttpClient({
    dangerouslyIgnoreCertificateErrors: [hostname],
  });
  try {
    return await fetch(url, { ...options, client });
  } finally {
    client.close();
  }
}
```

**Depois:**
```ts
async function fetchWithoutSSLVerification(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const { hostname } = new URL(url);
  // @ts-ignore - Deno-specific API
  const client = Deno.createHttpClient({
    // @ts-ignore
    dangerouslyIgnoreCertificateErrors: true, // true = ignorar TODOS os hosts
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      // @ts-ignore
      client,
    });
  } finally {
    clearTimeout(timer);
    client.close();
  }
}
```

A mudança crítica é: `dangerouslyIgnoreCertificateErrors: [hostname]` → `dangerouslyIgnoreCertificateErrors: true`. Passar um array de hostnames pode não funcionar corretamente quando o certificado tem um nome diferente do hostname usado na conexão (SNI mismatch). Usar `true` ignora todos os erros de certificado, que é o comportamento correto para dispositivos com certificados auto-assinados.

Também remover o `AbortSignal.timeout()` inline no `fortigateRequest` e deixar o timeout sendo gerenciado pelo `AbortController` dentro de `fetchWithoutSSLVerification`.

### 2 — Verificar `fortigate-compliance` para confirmar o padrão correto

Antes de implementar, comparar com a implementação que funciona na `fortigate-compliance` para garantir que estamos replicando o padrão exato.

## Arquivos modificados

| Arquivo | Operação |
|---|---|
| `supabase/functions/resolve-firewall-geo/index.ts` | Corrigir SSL bypass: `dangerouslyIgnoreCertificateErrors: true` + substituir `AbortSignal.timeout` por `AbortController` |

## Resultado esperado

Após o fix:
1. A Edge Function consegue conectar ao FortiGate com certificado auto-assinado
2. Retorna os múltiplos IPs WAN públicos com dados geo enriquecidos
3. O frontend detecta `data.multiple === true` e exibe o `WanSelectorDialog`
4. O usuário escolhe qual IP/localização usar
5. Os campos Latitude e Longitude são preenchidos com a escolha do usuário

## Sem mudanças no frontend

O código do frontend (`AddFirewallPage.tsx`) está correto — o dialog existe, o estado existe, a lógica de `data.multiple` está implementada. O problema é 100% na Edge Function não conseguindo passar pelo SSL do FortiGate.
