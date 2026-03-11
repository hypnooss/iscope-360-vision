

## Plano: Correção completa do fluxo M365 Compliance — Agendamento, Execuções e Barra de Progresso

### Diagnóstico completo (3 problemas interligados)

**Problema 1 — Barra de progresso "maluca" (flickering)**

Na tela de Compliance (`M365PosturePage.tsx`), a query `m365-active-analysis` (linha 143) busca registros `m365_posture_history` com status `pending` ou `partial`. O tenant `5a7d3b63` tem um registro antigo com `status: partial` e `completed_at: null` (ID: `302ebe0d`), criado em 10/Mar. Esse registro "morto" é continuamente detectado como análise ativa, ativando a barra de progresso. Em seguida, o polling da linha 181 detecta que o `agent_status` é `failed`, entra na condição `isFinished` e limpa o `activeAnalysisId`. Isso faz a barra sumir. 15 segundos depois, a query `m365-active-analysis` re-detecta o mesmo registro stale, e o ciclo recomeça — causando o flickering.

**Causa raiz:** A query não filtra por registros recentes nem por `completed_at IS NULL` de forma segura; qualquer registro `partial` antigo vira um loop infinito.

**Problema 2 — Agendamento não gera execução no Compliance**

A Edge Function `trigger-m365-posture-analysis` exige `supabase.auth.getUser()` (linhas 71-77). Quando o scheduler `run-scheduled-analyses` chama essa função com `Authorization: Bearer ${serviceKey}`, a chamada `getUser()` falha com `bad_jwt` porque o `service_role` key não é um JWT de usuário. Resultado: `401 Unauthorized`, nenhum registro em `m365_posture_history`, mas o scheduler avança o `next_run_at` mesmo assim (linha 540).

Evidência: zero registros em `m365_posture_history` nas últimas 4 horas, apesar dos schedules estarem ativos e com `next_run_at` no passado.

Comparação: `trigger-firewall-analysis` (que funciona) detecta o `service_role` token e faz bypass de auth (linhas 46-62). `trigger-m365-posture-analysis` NÃO tem esse padrão.

**Problema 3 — Scheduler avança `next_run_at` mesmo com falha**

Em `processM365ComplianceSchedules` (linha 540), o `next_run_at` é atualizado incondicionalmente, mesmo quando o trigger retorna erro. Isso mascara a falha — o agendamento parece ter executado, mas nada aconteceu.

---

### Correções planejadas

#### 1. `trigger-m365-posture-analysis` — Bypass de auth para `service_role`

Implementar o mesmo padrão de `trigger-firewall-analysis`:

```text
token === serviceRoleKey → isServiceRole = true → userId = 'system'
else → getUser() → userId = user.id

if (!isServiceRole) → validar has_client_access
```

O campo `analyzed_by` receberá `null` quando for chamada do sistema (schema permite null).

#### 2. `run-scheduled-analyses` — Só avançar `next_run_at` em sucesso

No bloco `processM365ComplianceSchedules`, mover o `update next_run_at` para dentro do `if (res.success || response.status === 409)`. Em caso de erro, manter o `next_run_at` atual para que o scheduler tente novamente no próximo ciclo.

#### 3. `M365PosturePage.tsx` — Eliminar flickering da barra de progresso

- Na query `m365-active-analysis` (linha 143), adicionar filtro temporal: buscar apenas registros criados nos últimos 15 minutos (`created_at > now() - 15min`). Isso evita que registros `partial` antigos reativem a barra.
- Adicionar `completed_at.is.null` no filtro para descartar registros que já finalizaram mas ficaram com status `partial`.

#### 4. `M365PosturePage.tsx` — Auto-refresh após conclusão da análise

O auto-refresh já existe (linha 225): `queryClient.invalidateQueries` é chamado quando `isFinished` é detectado. A correção do item 3 resolve o loop que impedia que isso funcionasse de forma estável.

#### 5. Cleanup do registro stale no banco

Atualizar o registro `302ebe0d` (status `partial`, `completed_at: null`, criado em 10/Mar) para `status: failed`, `completed_at: now()` via insert tool. Isso impede que ele cause problemas mesmo antes do deploy do código.

---

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Bypass de auth para service_role (padrão firewall) |
| `supabase/functions/run-scheduled-analyses/index.ts` | Condicionar `next_run_at` a sucesso no bloco Compliance |
| `src/pages/m365/M365PosturePage.tsx` | Filtro temporal na query de análise ativa |
| Banco (via insert tool) | Cleanup do registro partial stale |

### Resumo do fluxo corrigido

```text
Cron dispara → run-scheduled-analyses
  → verifica agent online ✓
  → chama trigger-m365-posture-analysis com service_role
  → bypass auth, cria m365_posture_history (pending)
  → cria agent_task (m365_powershell)
  → inicia Graph API em background
  → retorna success + analysis_id
  → scheduler avança next_run_at ✓

Frontend (se aberto durante execução):
  → query detecta registro recent (< 15min) com status pending/partial
  → mostra barra de progresso estável
  → polling a cada 15s até completed/failed
  → invalida queries → dados atualizados

Tela de Execuções:
  → m365_posture_history agora tem registros do scheduler
  → aparecem com tipo "M365 Compliance" e Agent = "Edge Function"
```

