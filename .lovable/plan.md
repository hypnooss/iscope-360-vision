
# Ajustes no Dashboard: Cor/Icone do Dominio Externo + CVEs no M365

## 1. Corrigir icone e cor do Dominio Externo

O banco de dados define o modulo "Dominio Externo" com:
- **Icone**: `Layers` (e nao `Globe` como esta no dashboard)
- **Cor**: `text-green-500` (e nao `text-teal-500` como esta no dashboard)

O card sera atualizado para usar `Layers` e `green-500` em todos os pontos (icone, fundo, borda).

## 2. Substituir severidades do M365 por CVEs recentes

Os badges "14 criticos / 8 altos" no card M365 nao sao severidades de postura -- sao CVEs da Microsoft. A proposta e:

- **Remover os badges de severidade do card M365**
- **Adicionar contagem de CVEs NEW** (ultimos 30 dias) ao lado do ScoreGauge
- Layout: um pequeno indicador compacto abaixo ou ao lado do gauge mostrando algo como "12 CVEs recentes" com a tag NEW animada (ja existente no sistema de CVEs)
- Usar o hook `useM365CVEs` (ja existe, com `months: 1` para 30 dias) para buscar a contagem
- Exibir apenas se houver CVEs (>0), de forma discreta

## Alteracoes tecnicas

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

1. **Importar `Layers`** do lucide-react (substituir `Globe` se nao for usado em outro lugar)
2. **Corrigir o card de Dominio Externo**:
   - `icon: Layers` (era `Globe`)
   - `iconColor: 'text-green-500'` (era `text-teal-500`)
   - `iconBg: 'bg-green-500/10'` (era `bg-teal-500/10`)
   - `borderColor: 'border-l-green-500'` (era `border-l-teal-500`)
3. **Importar e usar `useM365CVEs`** com `months: 1` para buscar CVEs dos ultimos 30 dias
4. **Modificar `ModuleHealthCard`** para aceitar uma prop opcional `extraInfo` (ReactNode) que sera renderizada ao lado ou abaixo do ScoreGauge
5. **Para o card M365**: passar como `extraInfo` um badge compacto com contagem de CVEs recentes e tag NEW animada, visivel apenas quando ha CVEs
6. **Remover os badges de severidade do card M365** (manter para Firewall que tem severidades reais de postura)

### Arquivo: `src/hooks/useDashboardStats.ts`

Nenhuma alteracao necessaria -- os dados de CVE vem do hook `useM365CVEs` separado.

### Resumo

| Arquivo | Acao |
|---------|------|
| `src/pages/GeneralDashboardPage.tsx` | Corrigir icone/cor Ext. Domain + adicionar CVEs ao card M365 |
