

## Renomear rota `/scope-m365/posture` para `/scope-m365/compliance`

Substituição direta de todas as referências em 5 arquivos:

### Arquivos a editar

1. **`src/App.tsx`** — Atualizar todas as rotas e redirects de `posture` para `compliance`
2. **`src/components/layout/AppLayout.tsx`** — Atualizar href do menu lateral
3. **`src/config/moduleDashboardConfig.ts`** — Atualizar `path`
4. **`src/pages/m365/M365ReportsPage.tsx`** — Atualizar navigate()
5. **`src/pages/m365/M365CVEsPage.tsx`** — Atualizar breadcrumb href

Adicionar redirect de `/scope-m365/posture` para `/scope-m365/compliance` para manter links antigos funcionando.

