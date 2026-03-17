

## Plano: Remover Entra ID e Colaboração (menu e rotas)

### 1. `src/components/layout/AppLayout.tsx`
Remover as duas entradas do menu lateral:
- Linha 145: `{ label: 'Entra ID', href: '/scope-m365/entra-id', icon: Shield }`
- Linha 147: `{ label: 'Colaboração', href: '/scope-m365/collaboration', icon: Users }`

### 2. `src/App.tsx`
- Remover lazy imports (linhas 64-67): `EntraIdPage`, `EntraIdSecurityInsightsPage`, `EntraIdApplicationInsightsPage`, `EntraIdAnalysisPage`
- Remover lazy import (linha 69): `CollaborationPage`
- Remover rotas (linhas 162-166): todas as rotas `/scope-m365/entra-id*`
- Remover rota (linha 171): `/scope-m365/collaboration`

### Arquivos de página e componentes
Os arquivos em `src/pages/m365/EntraId*.tsx`, `src/pages/m365/CollaborationPage.tsx` e `src/components/m365/collaboration/` e `src/components/m365/entra-id/` ficam órfãos mas não causam erro — podem ser removidos opcionalmente para limpeza.

