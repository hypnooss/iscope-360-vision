
# Nova tela wizard para adicionar Dominio Externo

## Resumo

Criar uma nova pagina `/environment/new/external-domain` com um formulario completo (wizard) para adicionar um dominio externo, incluindo um aviso legal sobre propriedade do dominio. O card "Dominio Externo" em `/environment/new` passara a navegar para essa nova rota.

## O que sera feito

### 1. Criar a pagina `src/pages/AddExternalDomainPage.tsx`

Pagina full-page (nao dialog) com:
- Breadcrumb: Ambiente > Novo Item > Dominio Externo
- Card centralizado (max-w-lg) com o formulario
- Campos reutilizados do `AddExternalDomainDialog`:
  - **Workspace** (select, carregado do Supabase)
  - **Agent** (select, filtrado pelo workspace selecionado)
  - **Dominio Externo** (input com validacao existente via `getExternalDomainError`)
  - **Frequencia de Analise** (select: Manual, Diario, Semanal, Mensal)
- **Aviso legal** (Alert/banner amarelo) com texto do tipo:
  > "Ao adicionar um dominio, voce declara ser o proprietario ou ter autorizacao explicita para realizar varreduras e analises neste dominio. Varreduras em dominios sem autorizacao podem violar leis e regulamentos."
- Botoes: Cancelar (volta para `/environment/new`) e Adicionar
- Logica de submit replicada do `handleAddDomain` da `ExternalDomainListPage` (insert em `external_domains` + `external_domain_schedules`)
- Apos sucesso, redireciona para `/scope-external-domain/domains`

### 2. Atualizar `src/pages/AddAssetPage.tsx`

Alterar a rota do card "Dominio Externo" de `/scope-external-domain/domains` para `/environment/new/external-domain`.

### 3. Atualizar `src/App.tsx`

Adicionar a rota `/environment/new/external-domain` com lazy load da nova pagina.

## Detalhes tecnicos

- A nova pagina buscara clientes (workspaces) e agents diretamente do Supabase, seguindo o mesmo padrao do `AddExternalDomainDialog`
- Validacao de dominio usa `getExternalDomainError` e `normalizeExternalDomain` de `@/lib/urlValidation` (normalizeExternalDomain sera movida/exportada)
- O aviso legal sera um componente `Alert` com icone `AlertTriangle` e variante warning
- Layout segue o mesmo padrao visual da pagina `/environment/new` (centralizado, card com padding)
