

# Substituir cards duplicados por Proteção contra Ameaças no Exchange Analyzer

## Problema
Os cards "Postura de Segurança" e "Tráfego de Email" estão duplicados na página -- essas informações já aparecem nos cards/categorias acima. O usuário quer substituí-los pela seção de Proteção contra Ameaças (Status das Políticas + Rankings de SPAM/Phishing/Malware), que hoje existe apenas na aba Proteção do M365 Analyzer.

## Dados necessários
Os dados de proteção (policy status, rankings) vêm de `M365AnalyzerMetrics.threatProtection`, que é carregado via `useLatestM365AnalyzerSnapshot` a partir da tabela `m365_analyzer_snapshots`. O Exchange Analyzer atualmente não carrega esses dados.

## Plano

### 1. Criar componente `ExchangeThreatProtectionSection`
Novo arquivo `src/components/m365/exchange/ExchangeThreatProtectionSection.tsx`

Componente standalone que renderiza:
- **Status das Políticas de Proteção** -- grid de 5 cards (Anti-Spam, Anti-Phishing, Safe Links, Safe Attachments, Malware Filter) com status Ativo/Fraco/Desativado
- **Rankings** -- grid de 3 colunas com Top Domínios de SPAM, Top Alvos de Phishing, Top Fontes de Malware

Reutilizará a mesma lógica visual do `ThreatProtectionTab` (PolicyCard e RankingList), mas sem os KPI cards, insights e funcionalidades de dismiss/detail sheet (que pertencem ao Analyzer completo). Recebe `threatProtection` como prop tipada com `M365AnalyzerMetrics['threatProtection']`.

### 2. Atualizar `ExchangeAnalyzerPage.tsx`
- Remover imports de `EmailSecurityPostureCard` e `EmailTrafficCard`
- Remover o bloco JSX que renderiza esses dois cards (linhas 198-204)
- Importar `useLatestM365AnalyzerSnapshot` de `@/hooks/useM365AnalyzerData`
- Chamar `useLatestM365AnalyzerSnapshot(selectedTenantId)` para obter os metrics
- Importar e renderizar `ExchangeThreatProtectionSection` no mesmo local, passando `data.metrics.threatProtection`

### Detalhes técnicos

O componente novo terá ~120 linhas e incluirá as sub-funções `PolicyCard` e `RankingList` extraídas/simplificadas do `ThreatProtectionTab`. Não inclui ThreatDetailSheet nem dismiss -- mantém a seção focada e leve.

Arquivos alterados: 2 (1 novo, 1 editado). Nenhuma migração de banco.

