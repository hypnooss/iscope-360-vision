
# Corrigir breadcrumb e menu da tela de edicao de dominio externo

## Problema

A pagina de edicao (`/scope-external-domain/domains/:id/edit`) esta com:
1. **Breadcrumb** apontando para "Dominio Externo > Dominios > Editar" - deveria referenciar "Ambiente"
2. **Menu lateral** destacando "Dominio Externo > Dominios Externos" - deveria destacar "Ambiente"

## Solucao

### 1. Mover a rota de edicao para debaixo de `/environment`

Alterar a rota de `/scope-external-domain/domains/:id/edit` para `/environment/external-domain/:id/edit` no `App.tsx`. Isso fara o menu lateral destacar "Ambiente" automaticamente, ja que o path comeca com `/environment`.

### 2. Atualizar o breadcrumb

No `ExternalDomainEditPage.tsx`, alterar o breadcrumb de:
- "Dominio Externo > Dominios > Editar"

Para:
- "Ambiente > Dominios Externos > Editar"

Com o link de "Ambiente" apontando para `/environment`.

### 3. Atualizar todas as referencias a rota antiga

Atualizar os `navigate()` e `href` nos seguintes arquivos:
- `src/pages/EnvironmentPage.tsx` - links de navegacao e o botao Editar
- `src/pages/external-domain/ExternalDomainListPage.tsx` - funcao `openEditPage`
- `src/pages/external-domain/ExternalDomainEditPage.tsx` - botao voltar e navegacao pos-salvar (apontarao para `/environment`)

### 4. Atualizar botao voltar e navegacao pos-salvar

Os botoes "Cancelar" e a seta de voltar na pagina de edicao devem navegar para `/environment` em vez de `/scope-external-domain/domains`.

## Detalhes tecnicos

### Arquivos modificados

- **`src/App.tsx`**: Trocar rota de `/scope-external-domain/domains/:id/edit` para `/environment/external-domain/:id/edit`
- **`src/pages/external-domain/ExternalDomainEditPage.tsx`**: Atualizar breadcrumb, botao voltar e navegacao pos-salvar para referenciar `/environment`
- **`src/pages/EnvironmentPage.tsx`**: Atualizar URLs de navegacao do botao Editar para a nova rota
- **`src/pages/external-domain/ExternalDomainListPage.tsx`**: Atualizar `openEditPage` para a nova rota
