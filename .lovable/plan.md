

## Refatorar M365 Analyzer: Radar de Incidentes em Tempo Real

### Visao Geral

Transformar a tela `M365AnalyzerDashboardPage` de um dashboard de compliance/metricas amplas para um **painel de monitoramento operacional** focado em incidentes ativos, anomalias recentes e triagem rapida.

### O que sera REMOVIDO

Da tela atual, remover os seguintes blocos:

- **Resumo Executivo** (5 colunas com metricas estaticas como "Sem MFA", "CA Desabilitadas", "Shared s/ owner")
- **Resumo de Metricas** (8 cards com metricas acumuladas: Mailboxes >90%, Sem MFA, CA Desabilitadas)
- **Category Tabs** com 12 categorias (muitas sao compliance/postura, nao eventos operacionais)
- Metricas zeradas que nao representam eventos ativos

### Nova Estrutura da Tela

A pagina sera reorganizada em 5 blocos, do mais urgente ao menos urgente:

---

**1. HEADER (refatorado)**

- Tenant selecionado + Botao "Executar Analise" + Agendamento (manter existente)
- Adicionar: seletor de periodo (1h / 6h / 24h) como filtro visual
- Indicador de status: bolinha verde/amarela/vermelha ao lado do nome do tenant
- Ultima coleta com tempo relativo ("ha 12 min")

**2. SCORE DE RISCO ATUAL (novo componente)**

- Gauge circular 0-100 baseado no `snapshot.score`
- Tendencia vs hora anterior (seta para cima/baixo + delta %)
- Contadores de severidade (Critical/High/Medium) como badges clicaveis que filtram os incidentes abaixo
- Borda com glow sutil se score > 70

**3. INCIDENTES ATIVOS (bloco principal - novo componente)**

- Agrupar insights filtrados apenas por categorias operacionais:
  - `account_compromise`, `suspicious_rules`, `phishing_threats`, `security_risk`
- Cards com maior peso visual para critical (borda vermelha com glow)
- Cada card mostra: nome, severidade, quantidade impactada, usuarios afetados, tempo desde deteccao, recomendacao
- Botoes de acao rapida (placeholder): "Ver Detalhes", "Bloquear Login", "Abrir Investigacao"
- Se nao houver incidentes, mostrar estado vazio positivo: "Nenhum incidente ativo"

**4. ANOMALIAS DE COMPORTAMENTO (novo componente)**

- Filtrar insights de: `behavioral_baseline`, `exfiltration`
- Mostrar desvios recentes com comparacao baseline
- Usuarios com envio 5x acima do padrao
- Login fora de horario
- Novo pais/IP detectado

**5. MOVIMENTO EXTERNO (refatorar rankings existentes)**

- Manter: Top dominios externos, Top usuarios com envio externo
- Remover: Top dominios remetentes de phishing (mover para incidentes)
- Sempre com label de recorte temporal

---

### Mudancas Tecnicas

| Arquivo | Acao |
|---|---|
| `src/pages/m365/M365AnalyzerDashboardPage.tsx` | Reescrever completamente (~759 linhas -> ~600 linhas). Remover blocos de compliance, adicionar novos componentes inline. |
| `src/types/m365AnalyzerInsights.ts` | Sem mudanca na estrutura de dados. Os dados ja vem com category e severity corretos. |
| `src/hooks/useM365AnalyzerData.ts` | Sem mudanca. O hook ja agrega snapshots e retorna insights/metrics. |

### Detalhes de Implementacao

**Filtro de periodo (1h/6h/24h):** Estado local que filtra visualmente os insights por `created_at` relativo. Nao altera a query (que ja busca 24 snapshots).

**Score de Risco:** Usar `snapshot.score` existente. Tendencia sera calculada comparando score do snapshot mais recente vs anterior (se `snapshotCount > 1`).

**Cards de Severidade clicaveis:** Estado local `activeSeverityFilter` que filtra a lista de incidentes abaixo.

**Categorias operacionais vs compliance:**
- Operacionais (manter): `security_risk`, `account_compromise`, `suspicious_rules`, `phishing_threats`, `behavioral_baseline`, `exfiltration`
- Compliance (remover da tela): `identity_access`, `conditional_access`, `exchange_health`, `audit_compliance`, `mailbox_capacity`, `operational_risks`

**Layout responsivo:** Grid de 1 coluna em mobile, 2-3 colunas em desktop para os blocos de anomalias e movimento externo.

**Modo compacto:** Toggle simples que reduz padding e font-size dos cards, para visao SOC em monitores.

### Resultado

A tela passara a funcionar como um **radar de incidentes** com foco em:
- Existe algo acontecendo agora?
- Isso piorou na ultima hora?
- Quem esta impactado?
- Preciso agir imediatamente?

