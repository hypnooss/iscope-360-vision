

## Problema

Os steps `analyzer` e `email_report` no `process-api-jobs` são **placeholders** que não executam nada:

```text
stepAnalyzer  → return { status: "placeholder" }
stepEmailReport → return { status: "placeholder" }
```

Além disso, o `stepCompliance` marca-se como "completed" imediatamente após criar a `agent_task`, mas a análise real (feita pelo agent Python) demora minutos. O `stepAnalyzer` precisa **esperar** essa análise terminar antes de prosseguir.

## Fluxo Correto

```text
register → compliance (cria agent_task + aguarda conclusão) → analyzer (attack surface scoped ao domínio) → email_report (envia PDF por email)
```

## Plano de Implementação

### 1. Refatorar `stepCompliance` — Aguardar conclusão da análise

Atualmente cria a task e retorna imediatamente. Mudar para:
- Criar a agent_task (como já faz)
- Retornar `analysis_id` mas **não** marcar como completed de imediato
- No loop principal do `process-api-jobs`, ao encontrar um step `compliance` em estado `running`, fazer **polling** no banco: verificar se a `external_domain_analysis_history` com source `agent` para aquele `domain_id` tem `status = 'completed'`
- Se completou → marcar step como `completed`
- Se falhou → marcar step como `failed`
- Se ainda pendente → não fazer nada (o cron roda de novo em 1 minuto)

Isso evita bloqueio da Edge Function e respeita o timeout.

### 2. Implementar `stepAnalyzer` — Attack Surface scoped ao domínio

Em vez de chamar `attack-surface-scan` (que escaneia TODOS os domínios do workspace), o analyzer no pipeline deve:
- Buscar os IPs apenas do domínio específico do job (`job.domain_id`)
- Usar a mesma lógica de `extractDomainIPs` e enriquecimento (Shodan/Censys/InternetDB)
- Salvar resultado num `attack_surface_snapshots` vinculado ao domínio
- Também aguardar polling (o scan pode demorar), similar ao compliance

Abordagem: chamar internamente a Edge Function `attack-surface-scan` passando `client_id` + um novo parâmetro `domain_id` para filtrar. Ou implementar inline no process-api-jobs chamando a function via fetch com o parâmetro adicional.

**Modificação em `attack-surface-scan/index.ts`:**
- Aceitar parâmetro opcional `domain_id` no body
- Se presente, filtrar apenas IPs daquele domínio em vez de todos do workspace
- Ignorar firewalls quando `domain_id` estiver presente

### 3. Implementar `stepEmailReport` — Enviar relatório por email

Usar a infraestrutura de email transacional (domínio `domainsecurity.online` já verificado):
- Scaffold transactional email
- Criar template de email com resumo do relatório (score, findings críticos)
- Enviar para o endereço em `step.params.to`
- Incluir link para o relatório completo no dashboard

### 4. Lógica de polling no loop principal

Modificar o loop de `process-api-jobs` para lidar com steps que são `running` e precisam de polling:
- Se step está `running` e é `compliance`: verificar se análise completou
- Se step está `running` e é `analyzer`: verificar se snapshot completou
- Se step está `running` e é `email_report`: executar envio (síncrono, rápido)

---

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-api-jobs/index.ts` | Refatorar compliance para polling async, implementar analyzer (chama attack-surface-scan com domain_id), implementar email_report (chama transactional email) |
| `supabase/functions/attack-surface-scan/index.ts` | Aceitar parâmetro opcional `domain_id` para filtrar IPs de um domínio específico |
| `supabase/functions/_shared/email-templates/` | Template de email do relatório (via scaffold) |
| Nova edge function de email transacional | Scaffold via ferramenta |

### Detalhes Técnicos

**Polling no compliance:**
```text
step.status === "running"
  → query analysis_history WHERE domain_id = X AND source = 'agent' AND status = 'completed'
  → se encontrou: step.status = "completed", step.result = { analysis_id, score }
  → se analysis.status = 'failed': step.status = "failed"
  → senão: noop (cron retry em 1 min)
```

**Analyzer scoped:**
```text
fetch(attack-surface-scan, { client_id, domain_id })
  → attack-surface-scan filtra: WHERE domain_id = X (em vez de todos)
  → retorna snapshot_id
  → polling: snapshot.status === 'completed'?
```

**Email report:**
```text
Busca último report_data do domain
Gera HTML com score, categorias, findings críticos
Envia via email transacional para step.params.to
```

