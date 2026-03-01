

## Evolucao da Aba "Movimento Externo" - Detector Inteligente de Exfiltracao

### Visao Geral

Transformar a aba "Movimento Externo" do Radar de Incidentes em um detector estatistico de comportamento anomalo por usuario, com baseline matematico individual baseado em janela movel de 30 dias.

---

### FASE 1 - Modelo de Dados (Migracoes SQL)

Criar duas novas tabelas:

**Tabela `m365_user_external_daily_stats`**
- `id` (uuid, PK)
- `tenant_record_id` (uuid, FK para m365_tenants)
- `client_id` (uuid)
- `user_id` (text) - UPN do usuario M365
- `date` (date)
- `total_external_emails` (integer)
- `total_external_mb` (numeric)
- `unique_domains` (integer)
- `mean_hour` (numeric) - hora media de envio
- `std_hour` (numeric) - desvio padrao do horario
- `hour_distribution` (jsonb) - distribuicao por hora (0-23)
- `domains_list` (text[]) - dominios usados nesse dia
- `created_at` (timestamptz)
- Constraint UNIQUE em (tenant_record_id, user_id, date)
- RLS: service_role full, users SELECT com has_client_access

**Tabela `m365_user_external_domain_history`**
- `id` (uuid, PK)
- `tenant_record_id` (uuid, FK para m365_tenants)
- `client_id` (uuid)
- `user_id` (text)
- `domain` (text)
- `first_seen` (timestamptz)
- `last_seen` (timestamptz)
- `total_emails` (integer)
- `total_mb` (numeric)
- `created_at` (timestamptz)
- Constraint UNIQUE em (tenant_record_id, user_id, domain)
- RLS: service_role full, users SELECT com has_client_access

**Tabela `m365_external_movement_alerts`**
- `id` (uuid, PK)
- `tenant_record_id` (uuid)
- `client_id` (uuid)
- `snapshot_id` (uuid, FK para m365_analyzer_snapshots, nullable)
- `user_id` (text)
- `alert_type` (text) - exfiltration, high_volume, new_domain, external_forward, off_hours
- `severity` (text) - critical, high, medium
- `title` (text)
- `description` (text)
- `risk_score` (integer, 0-100)
- `z_score` (numeric, nullable)
- `pct_increase` (numeric, nullable)
- `is_new` (boolean)
- `is_anomalous` (boolean)
- `affected_domains` (text[])
- `evidence` (jsonb) - dados brutos de suporte
- `created_at` (timestamptz)
- RLS: service_role full, users SELECT com has_client_access

---

### FASE 2 - Edge Function `m365-external-movement`

Nova Edge Function que:

1. **Ingere dados diarios**: Recebe metricas do analyzer snapshot (exfiltration metrics) e popula `m365_user_external_daily_stats` e `m365_user_external_domain_history`

2. **Calcula baseline por usuario** (janela movel 30 dias):
   - Media movel e desvio padrao para: emails externos, MB enviados, dominios unicos
   - Ignora primeiros 7 dias de novo usuario
   - Usa media parcial para usuarios com menos de 30 dias
   - Fallback se sigma = 0: se valor > media x 3, tratar como anomalo alto

3. **Deteccao por Z-Score**:
   - Z < 1.5: Normal
   - 1.5 <= Z < 2.5: Anomalo leve
   - 2.5 <= Z < 3.5: Anomalo relevante  
   - Z >= 3.5: Extremamente anomalo

4. **Deteccao por aumento percentual**:
   - 150%: Medium
   - 300%: High
   - 500%: Critical

5. **Modelo de horario anomalo**: Se envio fora de media +/- 2*desvio, marcar como off-hours

6. **Deteccao de novo dominio**: Verificar contra historico do usuario e do tenant. Peso maior para dominios recentes (<90 dias)

7. **Deteccao de exfiltracao** (critical se >= 3 criterios):
   - Z-score >= 3
   - >500MB enviados
   - Novo dominio
   - Envio fora do horario
   - Forward externo ativo
   - Login suspeito 24h
   - MFA falhou recentemente

8. **Risk Score (0-100)**: Soma acumulativa dos pesos definidos no spec

9. Grava alertas em `m365_external_movement_alerts`

---

### FASE 3 - Integracao com M365 Analyzer

Modificar `supabase/functions/m365-analyzer/index.ts` para chamar a logica de external movement apos processar o snapshot, passando os dados de exfiltration metrics coletados.

Alternativa: a Edge Function `m365-external-movement` pode ser invocada separadamente pelo trigger ou pelo scheduler.

---

### FASE 4 - Types e Hook (Frontend)

**Novo arquivo `src/types/externalMovement.ts`**:
- Interfaces para `ExternalMovementAlert`, `UserBaseline`, `AlertType`
- Constantes de severidade e labels

**Novo hook `src/hooks/useExternalMovementData.ts`**:
- Query `m365_external_movement_alerts` por tenant
- Agrupamento por severidade
- Estatisticas de resumo (total alertas, usuarios afetados, risk scores)

---

### FASE 5 - Componentes UI

**Novo componente `src/components/m365/analyzer/ExternalMovementTab.tsx`**:
- Estrutura identica a Incidentes: 3 colunas por severidade (Critical, High, Medium)
- Cada card inclui:
  - Titulo + Badge severidade
  - Nr ocorrencias + Nr usuarios
  - Indicador "Novo" e "Anomalo" (badges)
  - Risk Score (0-100) discreto
  - Botao Detalhes (abre dialog)

**Novo componente `src/components/m365/analyzer/ExternalMovementCard.tsx`**:
- Card individual do alerta, seguindo o mesmo padrao visual de `IncidentCard`
- Badge de severidade, metricas compactas, z-score display
- Dialog de detalhes com evidencias, baseline, recomendacao

**Modificar `src/pages/m365/M365AnalyzerDashboardPage.tsx`**:
- Substituir conteudo atual da tab "Movimento Externo" pelo novo `ExternalMovementTab`
- Tab sempre visivel (nao condicional a hasExternalMovement)
- Badge com contagem de alertas na tab

---

### Sequencia de Implementacao

1. Migracoes SQL (3 tabelas)
2. Types frontend (`externalMovement.ts`)
3. Edge Function `m365-external-movement`
4. Hook `useExternalMovementData.ts`
5. Componentes UI (`ExternalMovementCard`, `ExternalMovementTab`)
6. Integracao na page principal

### Arquivos a criar
- `src/types/externalMovement.ts`
- `src/hooks/useExternalMovementData.ts`
- `src/components/m365/analyzer/ExternalMovementTab.tsx`
- `src/components/m365/analyzer/ExternalMovementCard.tsx`
- `supabase/functions/m365-external-movement/index.ts`

### Arquivos a modificar
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` - integrar novo tab
- `supabase/config.toml` - registrar nova Edge Function

