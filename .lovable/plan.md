

## Implementar Sheet lateral nos módulos Incidentes, Anomalias e Movimento Externo

### Situação atual

- **Incidentes e Anomalias**: O `IncidentCard` (inline no `M365AnalyzerDashboardPage.tsx`) usa `Dialog` (modal central) para exibir detalhes.
- **Movimento Externo**: O `ExternalMovementCard` também usa `Dialog`.
- **Proteção contra Ameaças**: Já usa `Sheet` lateral com o padrão correto (`ThreatDetailSheet`).

### Objetivo

Converter os detalhes de Incidentes/Anomalias e Movimento Externo para abrir em `Sheet` lateral (50vw), seguindo o mesmo padrão visual do `ThreatDetailSheet` com abas Análise e Evidências.

### Alterações

**1. Novo componente: `src/components/m365/analyzer/IncidentDetailSheet.tsx`**

Sheet lateral para insights do Analyzer (incidentes e anomalias):
- **Header**: Icone de severidade + nome do incidente + badges (severidade, contagem, delta vs anterior)
- **Aba Análise**: Descrição, impacto contextual, recomendação (mesmo layout do ThreatDetailSheet)
- **Aba Evidências**: Lista de usuários afetados + metadados adicionais
- Cores por severidade: Critical=rosa, High=laranja, Medium=amarelo

**2. Novo componente: `src/components/m365/analyzer/ExternalMovementDetailSheet.tsx`**

Sheet lateral para alertas de movimento externo:
- **Header**: Icone de severidade + título + badges (severidade, risk score, tipo)
- **Aba Análise**: Descrição, métricas (Z-Score, aumento %, risk score), recomendação
- **Aba Evidências**: Domínios afetados + evidências do alerta
- Badges de "Novo" e "Anômalo"

**3. Editar `IncidentCard` em `M365AnalyzerDashboardPage.tsx`**

- Remover o `Dialog` inline
- Substituir por abertura do `IncidentDetailSheet`
- O botão "Detalhes" e click no card abrem o Sheet

**4. Editar `ExternalMovementCard.tsx`**

- Substituir `Dialog` por `ExternalMovementDetailSheet`

### Arquivos

1. `src/components/m365/analyzer/IncidentDetailSheet.tsx` — novo
2. `src/components/m365/analyzer/ExternalMovementDetailSheet.tsx` — novo
3. `src/pages/m365/M365AnalyzerDashboardPage.tsx` — substituir Dialog por Sheet no IncidentCard
4. `src/components/m365/analyzer/ExternalMovementCard.tsx` — substituir Dialog por Sheet

