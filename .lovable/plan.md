
## Diagnóstico (com base no seu print + dados do banco)
### 1) Card de Info mostrando N/A (NS / SOA / SOA Contact)
- Eu consultei o registro do relatório (`external_domain_analysis_history.id = 0553491b-...`) e o campo **`report_data.dns_summary` está NULL**.
- Como o Frontend usa `report_data.dns_summary` para preencher NS/SOA/SOA Contact, isso explica o **N/A** no topo, mesmo com “dados brutos” existindo dentro de cada check.

### 2) Evidência “Nenhum NS retornado” (mesmo com records presentes)
- O check `DNS-004` no banco está assim:
  - `rawData.data.records` tem 2 NS (Cloudflare), exatamente como você mostrou.
  - Porém `evidence` gravado ficou: “Nenhum NS retornado”.
- Isso indica que **na hora de gerar evidência**, o formatter não conseguiu “enxergar” os records no formato esperado (ou leu de um caminho diferente do que o rawData final acabou guardando).
- E como **todos os itens de “Segurança DNS” estão com o mesmo sintoma**, é bem provável que a leitura/normalização do step de DNS no backend esteja inconsistente entre:
  - “pegar valor para avaliar a regra”
  - “gerar evidência”
  - “gerar dns_summary”

---

## Objetivo (o que vamos corrigir)
1) Fazer o card de Info (NS/SOA/SOA Contact/DNSSEC) funcionar:
   - Para relatórios novos (via `dns_summary` corretamente preenchido no backend)
   - E também ter um **fallback** no frontend para relatórios antigos/sem `dns_summary`.

2) Corrigir as evidências de “Segurança DNS” para refletirem os dados reais:
   - Ex: mostrar “rachel.ns.cloudflare.com, jacob.ns.cloudflare.com” em vez de “Nenhum NS retornado”.

3) (Conseqüência) Garantir que a avaliação das regras use o mesmo “step data” que alimenta evidências e o resumo do header, evitando inconsistências.

---

## Mudanças planejadas (implementação)

### A) Backend — robustez na leitura dos steps DNS e geração consistente (Edge Function)
Arquivo: `supabase/functions/agent-task-result/index.ts`

#### A1) Criar um helper único para resolver “step payload” por step_id
Implementar um helper interno (sem imports) como:
- `getStepPayload(rawData, stepId)`
que tenta:
1. `rawData[stepId]` (formato “map por step_id”)
2. Se não existir, procurar em estruturas alternativas (caso existam):
   - `rawData.steps[]` com `{ step_id, data }`
   - `rawData.results[]` etc. (vamos cobrir os formatos comuns)
3. Retornar sempre um objeto consistente: `{ data, step_id }` quando possível.

Isso é importante porque hoje o comportamento está sugerindo que:
- os dados aparecem em `rawData`/rawData snapshot do check,
- mas o formatter/evaluator às vezes não encontra o mesmo caminho.

#### A2) Padronizar a extração de NS/SOA/DNSSEC para evidências
Atualizar `formatExternalDomainEvidence(stepId, sourceData)` para aceitar mais variações:
- NS:
  - `data.records` pode ser:
    - array de objetos: `{ host: string }`
    - array de strings: `"ns1..."` (caso algum executor retorne assim)
    - objetos com chaves alternativas: `{ name }` / `{ value }`
- SOA:
  - suportar `mname` ou `soa_mname`
  - suportar `contact_email` ou `soa_contact`
- DNSSEC:
  - suportar `has_dnskey` / `hasDs` etc (variações de naming)

E principalmente:
- Garantir que, se houver 1+ NS encontrados, a evidência sempre liste esses NS.
- Só mostrar “Nenhum NS retornado” se realmente não existir nada.

#### A3) Garantir que `dns_summary` seja preenchido usando o mesmo helper
Alterar a construção de `dnsSummary` para usar o mesmo `getStepPayload(rawData, 'ns_records')`, etc.
Com isso, `report_data.dns_summary` deve começar a vir preenchido em relatórios novos.

#### A4) Logs de diagnóstico (temporários, mas úteis)
Adicionar logs claros e pequenos (sem dump gigante) quando `target_type === external_domain`:
- `ns_records`: se encontrou payload? quantos records?
- `soa_record`: mname/contact (ou “missing”)
- `dnssec_status`: flags principais
- Isso vai acelerar se existir algum caso específico de domínio/step retornando em outro formato.

> Nota: As análises já gravadas no histórico não serão “reprocessadas” automaticamente. Você precisará rodar uma nova coleta para ver `dns_summary` preenchido no histórico novo.

---

### B) Frontend — fallback do card de Info para relatórios antigos/sem dns_summary
Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

#### B1) Fallback: derivar NS/SOA/DNSSEC a partir dos checks quando `report.dnsSummary` estiver vazio
Se `report.dnsSummary` não existir, vamos tentar:
- procurar dentro de `report.categories[].checks[]` checks cujo `rawData.step_id` seja:
  - `ns_records` → extrair `rawData.data.records`
  - `soa_record` → extrair `rawData.data.mname` / `contact_email`
  - `dnssec_status` → extrair flags
E montar um dnsSummary “local” somente para exibir o card.

Isso resolve imediatamente o “N/A” para relatórios legados, sem exigir reanálise.

---

### C) (Opcional, mas recomendado) Alinhar “Fonte dos dados”
Arquivo: `src/components/ComplianceCard.tsx` (ou manter como está se já estiver ok)
Atualmente aparece “Endpoint consultado: DNS Query (NS)”.
Se você preferir o texto “Fonte dos dados: DNS Query (NS)” (mais alinhado ao que você descreveu), faremos um ajuste de label apenas (sem lógica).

---

## Como vamos validar (passo a passo)
1) Abrir o relatório atual (o mesmo id do print):
   - Confirmar que o card de info passa a mostrar NS/SOA/SOA Contact (via fallback do frontend), sem N/A indevido.
   - Confirmar que “Diversidade de Nameservers” continua falhando (porque são 2 NS e a regra pede >=3), mas:
     - Evidência deve mostrar os 2 NS encontrados, não “Nenhum NS retornado”.

2) Rodar uma nova coleta do domínio:
   - Confirmar que o novo registro em `external_domain_analysis_history.report_data.dns_summary` vem preenchido.
   - Confirmar que as evidências em “Segurança DNS” agora batem com os dados brutos.

3) Conferir mais 2 checks de Segurança DNS:
   - DNSSEC Habilitado (DNS-001)
   - Registro DS (DNS-002)
   Para garantir que o formatter + evaluator estão consistentes.

---

## Arquivos que serão alterados
- `supabase/functions/agent-task-result/index.ts` (principal correção: normalização/extração e evidências + dns_summary)
- `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` (fallback para evitar N/A em relatórios sem dns_summary)
- (Opcional) `src/components/ComplianceCard.tsx` (apenas texto “Endpoint consultado” → “Fonte dos dados”, se você quiser)

---

## Resultado esperado (critérios de aceite)
- No card grande:
  - NS / SOA / SOA Contact deixam de aparecer como N/A quando existirem dados nos checks.
- Em “Segurança DNS”:
  - Evidência de NS mostra efetivamente os NS encontrados.
  - Regras continuam falhando/passar conforme o número real de NS (ex: 2 → falha no DNS-004).
- Relatórios novos passam a gravar `report_data.dns_summary` no histórico, e o frontend usa esse caminho de forma preferencial.
