

# Remover submenu e pagina "Dominios Externos"

## Justificativa

A pagina `ExternalDomainListPage` (`/scope-external-domain/domains`) e redundante porque:
- A listagem de dominios ja esta em **Ambiente** (`/environment`)
- A edicao ja redireciona para `/environment/external-domain/:id/edit`
- A exclusao ja funciona via modal em Ambiente
- A criacao ja usa `/environment/new/external-domain`

## O que sera feito

### 1. Remover o item "Dominios Externos" do submenu

No `AppLayout.tsx`, remover a linha `{ label: 'Dominios Externos', href: '/scope-external-domain/domains', icon: Globe }` do grupo `scope_external_domain`. O submenu ficara apenas com Compliance, Analyzer e Execucoes.

### 2. Remover a rota e o import do `ExternalDomainListPage`

No `App.tsx`:
- Remover o lazy import de `ExternalDomainListPage`
- Remover a rota `/scope-external-domain/domains`

### 3. Redirecionar referencias para `/environment`

- **`moduleDashboardConfig.ts`**: alterar `path` de `scope_external_domain` de `/scope-external-domain/domains` para `/environment`
- **`AddExternalDomainPage.tsx`**: alterar o `navigate('/scope-external-domain/domains')` pos-criacao para `navigate('/environment')`
- **`ExternalDomainReportsPage.tsx`**: alterar o botao "Verificar Dominio" de `/scope-external-domain/domains` para `/environment`

### 4. Manter o arquivo `ExternalDomainListPage.tsx`

O arquivo nao sera apagado neste momento por seguranca, mas ficara sem uso (dead code). Pode ser removido numa limpeza futura.

## Detalhes tecnicos

### Arquivos modificados

- **`src/components/layout/AppLayout.tsx`**: Remover item do menu
- **`src/App.tsx`**: Remover import e rota
- **`src/config/moduleDashboardConfig.ts`**: Alterar path para `/environment`
- **`src/pages/AddExternalDomainPage.tsx`**: Alterar redirect pos-criacao
- **`src/pages/external-domain/ExternalDomainReportsPage.tsx`**: Alterar link do botao

