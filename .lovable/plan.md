

## Correção: Snapshot Órfão + Auto-reconciliação no Frontend

### Situação atual

- O snapshot mais recente (e35b0fd4) está em `pending`, mas sua task (0454bf98) falhou: **todos os steps deram timeout de 120s** (problema de conexão PowerShell/Exchange no agent).
- A execução anterior (f0a1250d) funcionou corretamente: 5 insights, score 51, normalization v2.
- Os novos steps operacionais (mailbox_statistics, message_trace, inbox_rules, etc.) ainda não foram executados com sucesso porque foram adicionados ao blueprint depois da ultima execução bem-sucedida.
- A mensagem "Execução anterior encerrada com inconsistência" aparece porque o `useM365AnalyzerProgress` detecta o orphan mas não o corrige.

### Plano

#### 1. Auto-reconciliar snapshots órfãos no frontend

**Arquivo**: `src/hooks/useM365AnalyzerData.ts`

Quando `useM365AnalyzerProgress` detecta um snapshot orphan (snapshot pending/processing + task terminal), em vez de apenas reportar `reconciled: true`, fazer um `update` direto no snapshot para marcá-lo como `failed`. Isso elimina a necessidade de esperar a próxima execução do trigger.

Alteracao:
- Na query de progress, quando detectar orphan, executar `supabase.from('m365_analyzer_snapshots').update({ status: 'failed' }).eq('id', snap.id)`
- Retornar `status: 'failed'` em vez de `status: 'orphan'` para que a UI trate normalmente

#### 2. Melhorar a UI para estado de falha

**Arquivo**: `src/pages/m365/M365AnalyzerDashboardPage.tsx`

- Quando progress retornar `failed` com `wasOrphan: true`, mostrar mensagem clara: "Última execução falhou (timeout na coleta). Dados exibidos são da coleta anterior."
- Remover o estado "orphan" que gera confusão — tratar como falha normal com botão de re-execução

#### 3. Corrigir snapshot atual via SQL (ação imediata)

Marcar o snapshot órfão como `failed` para desbloquear a UI agora:

```sql
UPDATE m365_analyzer_snapshots 
SET status = 'failed', 
    metrics = jsonb_set(COALESCE(metrics, '{}'::jsonb), '{recovered_reason}', '"orphan_task_failed"')
WHERE id = 'e35b0fd4-69fe-4ddf-bcc2-751e63feb02b';
```

### Resultado

- A UI para de mostrar "inconsistência" e volta a exibir os dados da última coleta bem-sucedida (5 insights, score 51)
- Futuras falhas de task serão auto-reconciliadas pelo hook sem intervenção manual
- Os novos steps operacionais (mailbox capacity, message trace, etc.) serão exercitados na próxima execução bem-sucedida do agent

### Arquivos impactados
- `src/hooks/useM365AnalyzerData.ts` (auto-reconciliação)
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` (UI de falha melhorada)
- Migration SQL (correção imediata do snapshot)
