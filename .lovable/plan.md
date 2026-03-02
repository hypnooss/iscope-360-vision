

## Plano: Corrigir barra de progresso exibida em todos os Tenants

### Diagnóstico

Em `M365PosturePage.tsx`, o estado `activeAnalysisId` (linha 51) controla a exibição da barra de progresso (linha 280: `isAnalysisRunning = !!activeAnalysisId`). 

Quando o usuário troca de Workspace ou Tenant, esse estado **não é limpo**. Resultado: a barra de progresso de um tenant aparece em todos os outros.

A query `activeAnalysis` (linhas 78-93) até filtra por `selectedTenantId`, mas só roda quando `!activeAnalysisId` (linha 92) — ou seja, se já existe um ID ativo, ela nunca re-executa para verificar se o novo tenant tem análise ativa.

### Correção

Adicionar um `useEffect` que reseta `activeAnalysisId`, `analysisStartedAt` e `elapsed` sempre que `selectedTenantId` mudar.

**Arquivo**: `src/pages/m365/M365PosturePage.tsx`

Adicionar após o bloco de restauração (linha 138):

```typescript
// Reset analysis state when tenant changes
useEffect(() => {
  setActiveAnalysisId(null);
  setAnalysisStartedAt(null);
  setElapsed(0);
}, [selectedTenantId]);
```

Isso garante que:
- Ao trocar tenant, a barra some imediatamente
- A query `activeAnalysis` volta a rodar (porque `!activeAnalysisId` = true)
- Se o novo tenant tiver análise ativa, ela será detectada e a barra reaparece corretamente

Uma única mudança de ~5 linhas resolve o problema.

