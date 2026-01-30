
## Objetivo (o que vamos corrigir agora)

Você trouxe 2 pontos:

1) **UI**: No Domínio Externo, na seção expandida do check, você quer voltar o **ícone (prancheta/arquivo)** antes do título **“ANÁLISE EFETUADA”** (como era antes em “EVIDÊNCIAS COLETADAS”).

2) **Regra MX (Infraestrutura de Email)**: Em **“Prioridade MX Configuradas” (MX-003)** e **“Redundância MX” (MX-002)**, hoje está falhando quando o MX é um **hostname “alias”** (ex.: Microsoft 365) — mas esse hostname resolve em múltiplos IPs e, na prática, existe redundância. Precisamos validar isso corretamente.

---

## Diagnóstico rápido (com base no código)

### (1) Ícone “prancheta” no título
- Hoje, no `src/components/ComplianceCard.tsx`, o título “ANÁLISE EFETUADA” foi renderizado **sem ícone**.
- O ícone usado em “Evidências Coletadas” (default) é o `FileText` do lucide-react.
- Solução: adicionar `FileText` no header do bloco `variant === 'external_domain'`.

### (2) Regras MX e por que falham com Microsoft 365 / Gmail
- As regras de MX estão definidas no SQL (migration), com estes operadores:
  - **MX-002 Redundância MX**: `array_length_gte` de `data.records` >= 2
  - **MX-003 Prioridades MX Configuradas**: `has_distinct_priorities` em `data.records`
- Para provedores grandes, normalmente existe **1 MX record** (1 hostname), e a “redundância” está por trás do hostname (A/AAAA).
- Hoje o pipeline pega apenas os MX records (priority + exchange), sem resolver A/AAAA do exchange.

---

## Estratégia de implementação (sem quebrar outros módulos)

### Parte A — UI (rápida e isolada)
- Alterar apenas o `ComplianceCard.tsx` no bloco `external_domain`:
  - Header vira `flex items-center gap-1.5`
  - Recolocar `<FileText className="w-3 h-3" />` antes do texto “ANÁLISE EFETUADA”

Isso não mexe em permissões e não afeta Firewall/M365 (porque é só no variant `external_domain`).

---

### Parte B — “Redundância MX” e “Prioridades MX” com validação de alias (correção real)
Vamos corrigir de forma sólida e compatível com o que você descreveu (nslookup retornando múltiplos IPs).

#### B1) Melhorar o payload do agente (python-agent)
No `python-agent/agent/executors/dns_query.py`, no bloco `query_type == 'MX'`:
- Para cada record MX (`exchange`), fazer resolve best-effort de:
  - `A` e `AAAA` do hostname retornado (exchange)
- Salvar junto do record, por exemplo:
  - `resolved_ips: string[]` (IPs A + AAAA)
  - `resolved_ip_count: number`
  - opcional: `resolve_error?: string` (quando falhar)

Exemplo de estrutura por record:
```json
{
  "priority": 0,
  "exchange": "estrela-com-br.mail.protection.outlook.com",
  "resolved_ips": ["52.101.194.19", "...", "2a01:111:f403:c931::1"],
  "resolved_ip_count": 8
}
```

Isso deixa explícito no dado bruto que existe redundância por trás do alias.

#### B2) Ajustar a avaliação no backend (Edge Function) sem depender de mudar SQL
No `supabase/functions/agent-task-result/index.ts`, dentro de `processComplianceRules`, já existe um padrão de **“override por rule.code”** (ex.: `fw-001` etc).

Vamos adicionar overrides específicos para:
- **MX-002 (Redundância MX)**
  - `pass` se:
    - `records.length >= 2` (comportamento atual), **OU**
    - `records.length === 1` e `records[0].resolved_ip_count >= 2` (redundância via alias)
  - `fail` se:
    - `records.length === 0`, ou
    - `records.length === 1` e `resolved_ip_count < 2` (ou não disponível)

- **MX-003 (Prioridades MX Configuradas)**
  - `pass` se:
    - `has_distinct_priorities(records)` for verdadeiro (caso clássico com 2+ MX), **OU**
    - `records.length === 1` e `records[0].resolved_ip_count >= 2` (provedor gerenciado: failover “atrás” do hostname)
  - `warn/fail` (mantemos o comportamento atual) se:
    - não for possível determinar redundância do alias e só existir 1 record sem evidência de múltiplos IPs

Além disso, vamos melhorar o `details` (que é o que você quer que apareça para todos em “ANÁLISE EFETUADA”):
- Para M365/Gmail com 1 MX alias resolvendo múltiplos IPs, algo como:
  - “MX único (hostname gerenciado) resolve para X IP(s). Redundância provida pelo provedor.”

Isso responde exatamente ao seu ponto: “o agent não validou esse alias”.

---

## Arquivos que serão alterados

1) `src/components/ComplianceCard.tsx`
- Recolocar ícone `FileText` antes do título “ANÁLISE EFETUADA” no variant `external_domain`.

2) `python-agent/agent/executors/dns_query.py`
- Enriquecer retorno de MX com A/AAAA do hostname (`resolved_ips`, `resolved_ip_count`).

3) `supabase/functions/agent-task-result/index.ts`
- Adicionar overrides para `MX-002` e `MX-003` para considerar `resolved_ip_count` quando houver apenas 1 MX record.

---

## Critérios de aceite (como você valida)

### UI
- Expandir qualquer check no Domínio Externo:
  - “ANÁLISE EFETUADA” aparece com o mesmo ícone (prancheta/arquivo) que existia em “EVIDÊNCIAS COLETADAS”.

### MX
No relatório do domínio com MX do Microsoft 365:
- **MX-002 Redundância MX** deve ficar **pass** se o hostname resolver para múltiplos IPs.
- **MX-003 Prioridades MX Configuradas** não deve penalizar quando houver **1 MX alias** com múltiplos IPs (deve ficar **pass** com texto explicativo).
- Continuar funcionando como antes para domínios com 2+ MX (prioridades distintas etc).

---

## Riscos / Observações
- A resolução A/AAAA do exchange é “best-effort”: DNS pode falhar por timeout/ratelimit. Vamos tratar falhas de forma segura (não quebrar execução; apenas não considerar o fallback).
- Isso não muda o comportamento de Firewall/M365, apenas o módulo de Domínio Externo e somente as regras MX-002/MX-003 na geração do resultado.

---

## Teste end-to-end recomendado (rápido)
1) Abrir o relatório do domínio já na sua rota atual.
2) Ir em “Infraestrutura de Email”:
   - Expandir **Redundância MX** e **Prioridade MX Configuradas**.
3) Repetir com um domínio “normal” (com 2 MX records), se você tiver, para garantir que não regredimos o caso clássico.
