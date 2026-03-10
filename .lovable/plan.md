

# Substituir Insights de Compliance por Insights Operacionais no Exchange Analyzer

## Problema
Os "Insights de Segurança" do Exchange Analyzer exibem itens de **configuração/compliance** (Anti-Phishing Desabilitada, DKIM, SMTP Auth, etc.) vindos do `m365_posture_history`. Esses itens pertencem ao M365 Compliance. O Exchange Analyzer deve exibir **efeitos operacionais** -- incidentes como "Envio Anômalo de Emails", "SPAM massivo de dominio.com", "Malware detectado de dominio.com" -- que vêm do `m365_analyzer_snapshots`.

## Plano

### 1. Trocar a fonte de dados dos insights

Atualmente o `ExchangeSecurityInsightCards` recebe `ExchangeInsight[]` do hook `useExchangeOnlineInsights` (que lê `m365_posture_history`).

Substituir por: filtrar os `insights` do `analyzerSnapshot` (já carregado via `useLatestM365AnalyzerSnapshot`) pelas categorias relevantes ao Exchange:
- `threat_protection` (SPAM massivo, Malware detectado)
- `phishing_threats` (Phishing detectado)
- `behavioral_baseline` (Envio Anômalo)
- `suspicious_rules` (Regras de forward suspeitas)
- `exfiltration` (Volume anômalo externo)
- `exchange_health` (Saúde operacional)

Aplicar o mesmo filtro `isConfigurationalInsight` do M365 Analyzer para excluir itens de configuração que eventualmente apareçam.

### 2. Adaptar `ExchangeSecurityInsightCards` para `M365AnalyzerInsight[]`

O componente atualmente tipado com `ExchangeInsight`. Retipar para aceitar `M365AnalyzerInsight[]` (que tem `affectedUsers`, `count`, `metadata` ao invés de `affectedEntities`, `technicalRisk`, etc.).

Atualizar o Sheet lateral para exibir:
- Descrição e detalhes
- Recomendação
- Usuários afetados (`affectedUsers`) com contagem
- Metadata/evidências (subjects, domínios) quando disponível no `metadata.userDetails`

### 3. Atualizar `ExchangeAnalyzerPage.tsx`

- Remover import e uso de `useExchangeOnlineInsights` (que carregava compliance)
- Extrair insights do `analyzerSnapshot.insights` filtrados pelas categorias Exchange
- Passar para `ExchangeSecurityInsightCards` atualizado
- Limpar variáveis não mais usadas (`insightsError`, `errorCode`, etc.) que dependiam do hook removido

### Arquivos alterados
- `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx` -- retipar props e adaptar Sheet
- `src/pages/m365/ExchangeAnalyzerPage.tsx` -- trocar fonte de dados

### Resultado
Os insights exibidos serão operacionais/incidentes reais (SPAM massivo, envio anômalo, malware detectado, phishing, regras suspeitas) em vez de itens de configuração que pertencem ao Compliance.

