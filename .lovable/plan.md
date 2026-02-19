
# Corrigir a Lógica de Saída Bloqueada no Firewall Analyzer

## Diagnóstico do Problema

A função `analyzeOutboundTraffic` recebe um único array de logs e internamente tenta separar entre "allowed" e "blocked" pelo campo `action`. O problema está em como esse array é montado antes da chamada (linhas 1055–1064):

```
const outboundLogs = allowedLogs.length > 0 ? allowedLogs : acceptedFromDenied;
```

Como `allowed_traffic` já contém **somente** logs com `action=accept` (filtrado na API do FortiGate), nenhum deles terá `action=deny`. Logo, `blockedLogs` dentro da função sempre fica vazio → **aba "Saída Bloqueada" nunca tem dados**.

## Solução

Reestruturar a chamada para separar explicitamente as duas fontes de dados **antes** de chamar `analyzeOutboundTraffic`:

- **Saída Permitida** → vem de `allowed_traffic` (action=accept) **ou** de entradas com accept dentro de `denied_traffic`
- **Saída Bloqueada** → vem do `denied_traffic` original, identificando fluxos onde `srcip` é IP privado e `dstip` é IP público (independente do nome do step)

A assinatura de `analyzeOutboundTraffic` será atualizada para receber dois arrays separados: `allowedLogs` e `blockedLogs`, eliminando a ambiguidade de detecção pela `action`.

## Mudanças Técnicas

### Arquivo: `supabase/functions/firewall-analyzer/index.ts`

**1. Alterar a assinatura da função `analyzeOutboundTraffic`** (linha 854):

```ts
// ANTES
function analyzeOutboundTraffic(logs: any[], ipCountryMap)

// DEPOIS
function analyzeOutboundTraffic(allowedLogs: any[], blockedLogs: any[], ipCountryMap)
```

**2. Simplificar o corpo da função** — remover a separação interna por `action` (que era a lógica quebrada) e usar diretamente os dois arrays já separados para construir os rankings de destino.

**3. Alterar a montagem dos logs no handler** (linhas 1055–1064):

```ts
// ANTES (problemático)
const allowedData = raw_data.allowed_traffic?.data || raw_data.allowed_traffic || [];
const allowedLogs = Array.isArray(allowedData) ? allowedData : allowedData?.results || [];
const acceptedFromDenied = deniedLogs.filter(l => action === 'accept'...);
const outboundLogs = allowedLogs.length > 0 ? allowedLogs : acceptedFromDenied;
const outboundResult = analyzeOutboundTraffic(outboundLogs, ipCountryMap);

// DEPOIS (correto)
// Saída Permitida: allowed_traffic OU logs accept dentro de denied_traffic
const allowedData = raw_data.allowed_traffic?.data || raw_data.allowed_traffic || [];
const rawAllowedLogs = Array.isArray(allowedData) ? allowedData : allowedData?.results || [];
const acceptedFromDenied = deniedLogs.filter(l => {
  const action = (l.action || '').toLowerCase();
  return action === 'accept' || action === 'allow' || action === 'pass';
});
const outboundAllowedLogs = rawAllowedLogs.length > 0 ? rawAllowedLogs : acceptedFromDenied;

// Saída Bloqueada: sempre do denied_traffic, identificando fluxos internos → externos
const outboundBlockedLogs = deniedLogs.filter(l => {
  const action = (l.action || '').toLowerCase();
  const src = l.srcip || l.src || '';
  const dst = l.dstip || l.dst || '';
  const isDeny = action === 'deny' || action === 'block' || action === 'blocked' || action === '';
  return isDeny && isPrivateIP(src) && dst && !isPrivateIP(dst);
});

const outboundResult = analyzeOutboundTraffic(outboundAllowedLogs, outboundBlockedLogs, ipCountryMap);
```

**4. Dentro de `analyzeOutboundTraffic`**, substituir a lógica de separação por `isActionDenied` / `isOutboundCandidate` (que não funciona mais) por uso direto dos dois parâmetros:

```ts
function analyzeOutboundTraffic(
  allowedLogs: any[],
  blockedLogs: any[],
  ipCountryMap: Record<string, string> = {}
) {
  const insights: AnalyzerInsight[] = [];
  // ... buildDstRankings continua igual ...
  
  const allowedRank = buildDstRankings(allowedLogs.filter(isOutboundCandidate));
  const blockedRank = buildDstRankings(blockedLogs); // já filtrado externamente
  
  // ... insights e retorno continuam iguais ...
}
```

## Resultado Esperado

| Situação | Antes | Depois |
|---|---|---|
| allowed_traffic coletado | Saída Permitida ✅, Saída Bloqueada ❌ | Saída Permitida ✅, Saída Bloqueada ✅ |
| Sem allowed_traffic | Saída Permitida ❌, Saída Bloqueada ❌ | Saída Permitida ❌, Saída Bloqueada ✅ |

A correção não requer nova coleta de dados. Os snapshots existentes não serão reprocessados (são histórico), mas **a próxima análise já produzirá dados corretos** nas duas abas.

## Arquivo a Modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Atualizar assinatura e corpo de `analyzeOutboundTraffic` + reestruturar montagem dos logs no handler |
