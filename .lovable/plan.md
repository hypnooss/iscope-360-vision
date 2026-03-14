

## Melhorar layout da janela lateral de Insights do Colaboração Analyzer

### Problema

A `TeamsSecurityInsightCards` tem uma Sheet inline com layout básico: usa emojis como headers (🎯, ❓, ✅, 💼, 👥), não tem abas, não tem seções estilizadas, e exibe informações de forma simples. Comparado com:

- **ComplianceDetailSheet** (print 3): Tabs (Análise / Evidências / Dados), seções com ícones e bordas coloridas (DESCRIÇÃO, ANÁLISE EFETUADA, IMPACTO NO NEGÓCIO, RISCO TÉCNICO, RECOMENDAÇÃO)
- **IncidentDetailSheet** (Exchange/Entra): Já segue esse padrão com tabs, Section components, badges de tendência

### Solução

Refatorar a Sheet inline da `TeamsSecurityInsightCards` para reutilizar o `IncidentDetailSheet` existente, que já implementa o padrão desejado com:

- Header com ícone de severidade, badges (severidade, ocorrências, usuários, tendência)
- Tabs: **Análise** (Descrição, Impacto, Recomendação) e **Evidências** (userDetails, affected users, metadata)
- Seções com `Section` component estilizado (bordas, ícones, variantes warning/default)

### Alteração

**Arquivo: `src/components/m365/teams/TeamsSecurityInsightCards.tsx`**

1. Importar `IncidentDetailSheet` de `@/components/m365/analyzer/IncidentDetailSheet`
2. Remover todo o bloco `<Sheet>` inline (linhas 101-205)
3. Substituir por `<IncidentDetailSheet insight={selectedInsight} open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)} />`
4. Remover imports não mais usados (`Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `ScrollArea`, `Users`)

Resultado: mesma Sheet rica das prints 2 e 3, com zero duplicação de código.

