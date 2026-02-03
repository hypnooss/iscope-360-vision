# Migração da Enumeração de Subdomínios para Edge Function

## ✅ Status: CONCLUÍDO

**Data:** 2026-02-03

## Resumo

A enumeração de subdomínios foi migrada do Python Agent (rede do cliente) para uma Edge Function (servidor Supabase), resolvendo problemas de:
1. **DNS mascarado** - IPs internos como `172.16.10.250` aparecendo em vez dos públicos
2. **APIs bloqueadas** - Firewalls corporativos bloqueando APIs de enumeração
3. **Inconsistência** - Resultados variando conforme a rede do cliente

## Arquitetura Implementada

```text
┌──────────────────────────────────────────────────────────────┐
│                    ARQUITETURA HÍBRIDA                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Python Agent (rede do cliente)                               │
│  └─ Executa APENAS: ns, mx, soa, spf, dmarc, dkim, dnssec    │
│                                                               │
│                        ↓                                      │
│                                                               │
│  agent-task-result (Edge Function)                            │
│  └─ Detecta target_type = 'external_domain'                   │
│  └─ Chama subdomain-enum Edge Function                        │
│  └─ Mescla resultados + processa compliance                   │
│                                                               │
│                        ↓                                      │
│                                                               │
│  subdomain-enum (Nova Edge Function)                          │
│  └─ Consulta 9 APIs públicas em paralelo                      │
│  └─ Usa DNS-over-HTTPS (Cloudflare/Google)                    │
│  └─ Retorna IPs públicos reais                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Alterações Realizadas

### 1. Nova Edge Function: `supabase/functions/subdomain-enum/index.ts`
- Consulta 9 APIs: crt.sh, HackerTarget, AlienVault, RapidDNS, ThreatMiner, URLScan, Wayback, CertSpotter, JLDC
- Resolução DNS via DoH (Cloudflare + Google fallback)
- Limite de 200 resoluções DNS por execução (evitar timeout)
- Retorna `{ subdomain, sources, ips, is_alive }`

### 2. Atualização: `supabase/functions/agent-task-result/index.ts`
- Adicionado `payload` na query de busca da task
- Após receber resultados do agent, chama `subdomain-enum` para domínios externos
- Injeta resultado em `rawData['subdomain_enum']` antes do processamento de compliance

### 3. Blueprint Atualizado: `device_blueprints` (ID: 27b856b1-3b20-4180-b9da-ea5834c55ac6)
- Removido step `subdomain_enum` do blueprint de External Domain
- Agent agora executa apenas os 7 steps DNS diretos

### 4. Python Agent: Limpeza
- Removido `python-agent/agent/executors/subdomain_enum.py`
- Removido import/mapping de `SubdomainEnumExecutor` de `__init__.py` e `tasks.py`

## Benefícios

| Aspecto | Antes (Agent) | Depois (Edge Function) |
|---------|---------------|------------------------|
| **DNS** | Mascarado por DNS interno | IPs públicos reais via DoH |
| **APIs** | Podem estar bloqueadas | Sempre acessíveis |
| **Consistência** | Varia por ambiente | Sempre igual |
| **Manutenção** | Python + TypeScript | TypeScript centralizado |

## Como Testar

1. Disparar uma nova análise de External Domain
2. Verificar nos logs da Edge Function `agent-task-result` a mensagem:
   ```
   [external_domain] Invoking server-side subdomain enumeration for {domain}
   [external_domain] Subdomain enum completed: X found, Y alive
   ```
3. Conferir no relatório se os IPs são públicos (não RFC1918)
