
# Criar menu "Ambiente" e tela unificada de gestao de ativos

## Objetivo

Adicionar um novo item "Ambiente" no menu lateral, posicionado acima de "Usuarios" (e apos os modulos + divisor). A tela correspondente listara todos os itens monitorados do workspace (Firewalls, Dominios Externos e Tenants M365) numa unica interface, seguindo o padrao visual ja utilizado nas telas de Dominio Externo.

## Posicao no menu

```text
Dashboard
[Modulos em ordem alfabetica]
--- divisor ---
Ambiente        <-- NOVO
Usuarios
Agents
--- divisor ---
Administracao
```

## Estrutura da tela

A tela "Ambiente" tera:
- Breadcrumb: Ambiente
- Titulo + subtitulo
- Seletor de Workspace no cabecalho (Super Admin / Super Suporte)
- Stats cards (glass-card): Total de ativos, Firewalls, Dominios Externos, Tenants M365
- Campo de busca (input solto, sem card wrapper)
- Tabela unificada com colunas: Nome, Tipo (badge colorida por modulo), Workspace, Score, Status, Acoes
- Cada linha tera um botao para navegar ao detalhe do item no modulo respectivo

## Detalhes tecnicos

### 1. Novo arquivo: `src/pages/EnvironmentPage.tsx`

- Seguir padrao de ExternalDomainListPage (useEffectiveAuth, workspace selector, glass-card stats, tabela em Card sem CardHeader)
- Buscar dados de 3 tabelas: `firewalls`, `external_domains`, `m365_tenants`
- Unificar em um array com campos normalizados (id, name, type, workspace, score, status)
- Filtro de busca por nome/tipo/workspace
- Botao de acao por tipo para navegar a pagina de edicao/detalhe do respectivo modulo
- Icone do menu: `Monitor` (de lucide-react)

### 2. Rota em `src/App.tsx`

- Adicionar: `<Route path="/environment" element={<EnvironmentPage />} />`
- Lazy load como as demais paginas

### 3. Menu lateral em `src/components/layout/AppLayout.tsx`

- Adicionar `SidebarLink` para "/environment" com icone `Monitor` e label "Ambiente"
- Posicionar apos o divisor dos modulos e antes de "Usuarios"
- Visivel para todos os roles que tem acesso (mesmo criterio de `canAccessUsers` -- workspace_admin e super_admin)
- Adicionar "/environment" na deteccao de rotas ativas (useEffect do pathname)

### 4. Tabela de tipos por badge

| Tipo | Label | Cor |
|------|-------|-----|
| firewall | Firewall | orange |
| external_domain | Dominio Externo | teal |
| m365_tenant | Tenant M365 | blue |

### 5. Navegacao por tipo

- Firewall: `/scope-firewall/firewalls/{id}/edit`
- Dominio Externo: `/scope-external-domain/domains/{id}/edit`
- Tenant M365: `/scope-m365/tenant-connection` (nao tem pagina de edicao individual por enquanto)
