

# Correcoes do Dashboard Geral

## Problemas identificados

### 1. Bug critico: severidades identicas em todos os modulos
No hook `useDashboardStats.ts`, o spread `{ ...emptyHealth }` e raso (shallow copy). O objeto `severities` dentro de `emptyHealth` e compartilhado por referencia entre `fwHealth`, `m365Health` e `extHealth`. Quando o loop do Firewall acumula valores em `fwHealth.severities.critical += ...`, ele esta na verdade mutando o mesmo objeto que os outros modulos usam. Resultado: todos os 3 cards mostram os mesmos numeros.

**Correcao**: criar objetos `severities` independentes para cada modulo em vez de usar spread do `emptyHealth`.

### 2. Remover secoes "Resumo Operacional" e "Atividade Recente"
Conforme solicitado, as secoes 2 e 3 serao removidas da pagina.

### 3. Card de Infraestrutura (Agents) como Module Health Card
O card de infraestrutura deve seguir o mesmo padrao visual dos demais cards de modulo (com borda lateral, icone, contagem), em vez do layout diferente atual.

### 4. Cores dos modulos devem seguir o padrao do menu lateral
As cores no sidebar (`AppLayout.tsx`) sao:
- **Firewall**: `text-orange-500` (ja correto)
- **Microsoft 365**: `text-blue-500` (ja correto)
- **Dominio Externo**: `text-teal-500` (no dashboard esta `text-purple-500`, precisa corrigir)

## Alteracoes tecnicas

### Arquivo 1: `src/hooks/useDashboardStats.ts`

Corrigir o bug do shallow copy. Substituir:
```typescript
const fwHealth: ModuleHealth = { ...emptyHealth, assetCount: fwRes.count || 0 };
```
Por:
```typescript
const fwHealth: ModuleHealth = {
  score: null,
  assetCount: fwRes.count || 0,
  lastAnalysisDate: null,
  severities: { critical: 0, high: 0, medium: 0, low: 0 },
};
```
Mesmo tratamento para `m365Health` e `extHealth`. Isso garante que cada modulo tenha seu proprio objeto `severities` independente.

Remover campos que nao serao mais usados no dashboard: `totalSeverities`, `totalAssets`, `lastOverallAnalysis`, `recentActivity` e toda a logica de queries de "recent activity" (linhas 198-306). Isso simplifica o hook e reduz queries desnecessarias.

### Arquivo 2: `src/pages/GeneralDashboardPage.tsx`

1. **Corrigir cor do Dominio Externo**: mudar de `text-purple-500` / `bg-purple-500/10` / `border-l-purple-500` para `text-teal-500` / `bg-teal-500/10` / `border-l-teal-500`

2. **Adicionar card de Agents** como um `ModuleHealthCard` com:
   - Icone: `Server` (ou `MonitorCheck`)
   - Cor: `text-emerald-500` (verde, indicando status operacional)
   - Score: representado como percentual de agents online (ex: 10/10 = 100%)
   - Asset count: "X/Y agents online"
   - Sem severidades
   - Sem link de navegacao (ou navegando para `/agents`)

3. **Remover secao "Resumo Operacional"** (StatCards de severidade + InfrastructureCard)

4. **Remover secao "Atividade Recente"** (timeline inteira)

5. **Remover componente `InfrastructureCard`** que nao sera mais usado

O dashboard ficara apenas com a secao "Postura de Seguranca por Modulo" contendo os Module Health Cards (Firewall, M365, Dominio Externo, Agents).

### Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/hooks/useDashboardStats.ts` | Corrigir bug de severidades + remover campos nao usados |
| `src/pages/GeneralDashboardPage.tsx` | Corrigir cores + adicionar card Agents + remover secoes 2 e 3 |
