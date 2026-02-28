

## Plano: Remover chamada legacy `fortigate-compliance`

### Contexto
A função `handleAnalyze` em `src/pages/FirewallsPage.tsx` (linhas 206-248) chama diretamente a edge function `fortigate-compliance`, enviando URL e API key pelo frontend. Isso bypassa completamente o fluxo de blueprints/agente e é código legacy que deveria ter sido removido.

### Mudanças

1. **`src/pages/FirewallsPage.tsx`**: Substituir `handleAnalyze` para usar `trigger-firewall-analysis` (mesmo fluxo do `FirewallCompliancePage.tsx`), ou remover o botão de análise desta página e direcionar o usuário para a página de Compliance.

2. **`supabase/functions/fortigate-compliance/index.ts`** (opcional): Marcar para remoção futura ou deletar, já que nenhuma outra parte do código a utiliza.

### Arquivos editados
- `src/pages/FirewallsPage.tsx` — substituir `handleAnalyze` pelo fluxo via agente
- (Opcional) Deletar `supabase/functions/fortigate-compliance/index.ts`

