
## Contexto do problema (o que está acontecendo hoje)

1) **Card grande (info) do relatório de Domínio Externo**
- Hoje ele mostra “Domínio / Cliente / Nome / Data”, mas você quer que ele mostre dados técnicos de DNS:
  - **NS**
  - **SOA**
  - **SOA Contact**
  - **DNSSEC Status**
- E para textos longos: **truncar com “...”** e, ao passar o mouse, **mostrar o conteúdo completo** (tooltip ou alternativa equivalente).

2) **Checks “parecem desativados” + sem fonte/evidências/dados brutos**
- No UI, ao clicar em um check (ex: “Segurança DNS > Diversidade de Nameservers”), “não acontece nada”.
- Para Super Admins, você quer ver:
  - **Fonte dos dados** (no Firewall era “Endpoint consultado”)
  - **Evidências coletadas**
  - **Dados brutos (JSON)**

### Por que isso está falhando (raiz provável)
- No backend, as regras de Domínio Externo foram inseridas com `evaluation_logic` no formato:
  - `{"step_id": "...", "field": "...", "operator": "...", ...}`
- Mas a edge function `agent-task-result` hoje só sabe avaliar regras no formato:
  - `evaluation_logic.source_key`, `evaluation_logic.field_path`, `evaluation_logic.conditions[]` (estilo firewall)
- Resultado: muitas regras ficam com **status “unknown”** porque “dados não disponíveis” (o backend não está lendo corretamente a estrutura do rawData para essas regras).
- E no frontend, o componente `ComplianceCard` só “abre detalhes” quando existe `check.evidence` — se `evidence` vier vazio/undefined, o clique não expande nem mostra nada (parece “desativado”).

---

## Objetivos (o que vou implementar)

### A) Card grande (info) — substituir campos e melhorar UX
- Remover do card grande:
  - **Nome**
  - **Cliente**
  - **Data**
- Inserir:
  - **NS** (lista ou string consolidada)
  - **SOA** (mname)
  - **SOA Contact** (contact_email)
  - **DNSSEC Status** (baseado no step `dnssec_status`)
- Implementar “texto truncado + tooltip” para valores longos.

### B) Validar e corrigir as verificações de Domínio Externo
- Ajustar o backend para conseguir **avaliar corretamente** as regras cujo `evaluation_logic` usa `step_id/field/operator`.
- Garantir que o resultado final (report_data) inclua informações suficientes para:
  - Mostrar “Fonte dos dados” (para Super Admin)
  - Mostrar evidências (quando fizer sentido)
  - Mostrar dados brutos (para Super Admin)

### C) Tornar os checks clicáveis/expansíveis mesmo sem evidência
- Alterar o `ComplianceCard` para permitir expandir detalhes quando existir **qualquer uma** destas coisas (para super admin):
  - `apiEndpoint` (Fonte)
  - `rawData`
  - `evidence`
- E também permitir expandir para mostrar ao menos “Detalhes” (description/details), mesmo sem evidência, para que o clique nunca pareça “morto”.

---

## Exploração dos dados disponíveis (já existentes no projeto)
Os steps do blueprint de domínio externo (pelo SQL de migração) são:
- `ns_records`
- `mx_records`
- `soa_record`
- `spf_record`
- `dmarc_record`
- `dkim_records`
- `dnssec_status`

O Python Agent (executor dns_query) retorna dados estruturados como:
- NS: `data.records[{host}]`
- SOA: `data.mname`, `data.contact_email`, `data.serial`, etc
- DNSSEC: `data.has_dnskey`, `data.has_ds`, `data.validated`, `data.notes[]`

Isso nos permite alimentar tanto:
- O card grande (NS/SOA/DNSSEC)
- Evidências e raw JSON por check

---

## Mudanças propostas (arquivos e o que muda)

### 1) Backend: `supabase/functions/agent-task-result/index.ts`
#### 1.1. Suporte ao `evaluation_logic` de Domínio Externo (step_id/field/operator)
- Implementar um “adaptador” dentro do processamento de regras para que, quando `evaluation_logic.step_id` existir:
  - `source_key = step_id` (ex: `ns_records`)
  - `field_path = field` (ex: `data.records`)
  - Avaliar operadores do domínio externo:
    - `not_null`
    - `eq`
    - `gte`
    - `in` (com `values`)
    - `array_length_gte`
    - `array_length_lte`
    - `between` (min/max)
    - `has_distinct_priorities`
    - `not_matches` (regex invertido)
- Isso vai fazer com que as regras deixem de “unknown” e passem a dar pass/fail/warn de acordo com o esperado.

#### 1.2. “Fonte dos dados” coerente para Domínio Externo
- Expandir o `sourceKeyToEndpoint` para incluir:
  - `ns_records` -> `DNS Query (NS)`
  - `soa_record` -> `DNS Query (SOA)`
  - `dnssec_status` -> `DNS Query (DNSSEC)`
  - `spf_record` -> `DNS Query (SPF/TXT)`
  - `dmarc_record` -> `DNS Query (DMARC/TXT)`
  - `dkim_records` -> `DNS Query (DKIM/TXT)`
  - `mx_records` -> `DNS Query (MX)`
- Assim, no UI “Fonte dos dados” fica padronizado (mesmo conceito do “endpoint” do Firewall, só que aqui é “DNS Query (tipo)”).

#### 1.3. Incluir um “resumo DNS” no report_data para o card grande
Hoje o historyReportData salva `score/checks/categories/...`. Vou adicionar também algo como:
- `dns_summary: { ns: string[], soa_mname: string|null, soa_contact: string|null, dnssec_status: string, dnssec_has_dnskey: boolean, dnssec_has_ds: boolean }`

Importante: isso é leve e não explode o tamanho do JSON.

#### 1.4. Evidências/dados brutos para checks (Domínio Externo)
- Para Domínio Externo, mesmo que não exista um formatter dedicado, vamos garantir evidências básicas:
  - Para `ns_records`: evidência listando os NS encontrados
  - Para `soa_record`: evidência com mname e contact_email
  - Para `dnssec_status`: evidência com has_dnskey/has_ds + notes (se houver)
  - Para SPF/DMARC/DKIM/MX: evidência com “raw” e/ou itens principais (onde existir)
- E também preencher `rawData` com um recorte do step correspondente para Super Admins (sem ser gigante).

---

### 2) Frontend: Card grande com NS/SOA/DNSSEC (truncado + tooltip)
Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

#### 2.1. Remover Nome/Cliente/Data e inserir campos DNS
- No bloco “Parte superior: Info”:
  - Remover os itens “Cliente”, “Nome”, “Data”
  - Inserir:
    - **NS**: exibir como string “ns1..., ns2..., ns3...”
    - **SOA**: `soa_mname`
    - **SOA Contact**: `soa_contact`
    - **DNSSEC Status**: texto amigável:
      - “Ativo” se `has_dnskey && has_ds`
      - “Parcial” ou “Incompleto” se apenas um deles existir
      - “Inativo” se nenhum existir
      - (e opcional: tooltip com notes)
- A informação de “Cliente” e “Data” ainda continuam disponíveis em outros lugares (breadcrumb e header já mostram a data). Se você quiser, posso manter “Data” apenas no subtítulo do header e não no card (ficaria consistente com o Firewall).

#### 2.2. Truncar texto + tooltip no hover
- Implementar um mini componente reaproveitável, por exemplo:
  - `TruncatedText` (pode ser dentro do próprio arquivo ou um componente compartilhado)
- Estratégia:
  - Visual: `truncate` (Tailwind) + `max-w-*`
  - Hover: `Tooltip` do Radix (já existe em `src/components/ui/tooltip.tsx`)
- Isso garante:
  - Layout limpo
  - Acesso ao valor completo sem quebrar a UI

---

### 3) Frontend: Checks clicáveis + mostrar Fonte/Evidências/RawData
Arquivo: `src/components/ComplianceCard.tsx`

#### 3.1. Tornar o card expansível mesmo sem `evidence`
- Ajustar a lógica:
  - `hasDetails = canViewEvidence && (check.evidence?.length || check.rawData || check.apiEndpoint)`
  - E/ou permitir expandir sempre, exibindo ao menos a seção “Detalhes” com `check.details` / `check.description`
- O clique no card deve:
  - Alternar expand/collapse sempre (ou pelo menos quando há conteúdo para mostrar).
- Isso resolve a sensação de “verificação desativada”.

#### 3.2. Exibir “Fonte dos dados” mesmo sem evidência
- Mostrar a linha “Fonte dos dados” quando:
  - `canViewEvidence && check.apiEndpoint` (para Domínio Externo vai virar “DNS Query (NS)” etc)

#### 3.3. Evidências + Dados brutos
- Manter como já está, mas agora:
  - Evidência vai existir para Domínio Externo (por backend)
  - E mesmo se não existir, o card ainda abre e mostra a fonte e/ou rawData quando presentes

---

## Sequência de implementação (passo a passo)
1) Ajustar backend (`agent-task-result`) para suportar `evaluation_logic.step_id/field/operator` e mapear “fonte” para DNS.
2) Enriquecer `report_data` com `dns_summary`.
3) Ajustar frontend (`ExternalDomainAnalysisReportPage`) para renderizar NS/SOA/SOA Contact/DNSSEC com truncamento + tooltip.
4) Ajustar `ComplianceCard` para expandir corretamente e exibir fonte/evidências/rawData conforme permissões.
5) Validar end-to-end gerando nova coleta para um domínio real:
   - Conferir score/categorias mudaram de “unknown”
   - Ver “Fonte dos dados” em checks
   - Ver evidências e JSON bruto para Super Admin
   - Conferir card grande com DNS fields, truncamento e tooltip funcionando

---

## Critérios de aceite (checklist)
- Card grande mostra **NS / SOA / SOA Contact / DNSSEC Status** e não mostra Nome/Cliente/Data.
- Textos longos no card ficam com “...” e tooltip no hover mostra o texto completo.
- Checks de “Segurança DNS > Diversidade de Nameservers” deixam de parecer “desativados”:
  - Card expande e mostra ao menos detalhes
  - Para Super Admin: mostra fonte, evidências e dados brutos quando disponíveis
- Regras de Domínio Externo passam a avaliar corretamente usando os steps (`ns_records`, `soa_record`, `dnssec_status`, etc).

---

## Observação importante sobre dados já gerados
As análises antigas (já gravadas no histórico) podem continuar “sem evidência/sem score correto” porque foram calculadas antes da correção do engine de avaliação.
Após a mudança, você deve rodar **uma nova coleta** para ver o relatório completo e consistente.