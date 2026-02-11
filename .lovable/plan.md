

# Corrigir Breadcrumbs das paginas de Administracao

## Problema

As paginas **Administradores**, **Workspaces** e **Configuracoes** estao mostrando o breadcrumb apenas com o nome da pagina (ex: "Administradores"), sem o prefixo "Administracao >". Enquanto isso, as paginas **Templates** e **Agendamentos** ja exibem corretamente "Administracao > Templates".

As paginas **Usuarios** e **Agents** estao corretas, pois sao itens de nivel superior no menu lateral (nao pertencem ao grupo Administracao).

## Alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/pages/AdministratorsPage.tsx` | Alterar breadcrumb de `[{ label: 'Administradores' }]` para `[{ label: 'Administracao' }, { label: 'Administradores' }]` |
| `src/pages/ClientsPage.tsx` | Alterar breadcrumb de `[{ label: 'Workspaces' }]` para `[{ label: 'Administracao' }, { label: 'Workspaces' }]` |
| `src/pages/admin/SettingsPage.tsx` | Alterar breadcrumb de `[{ label: 'Configuracoes' }]` para `[{ label: 'Administracao' }, { label: 'Configuracoes' }]` |

Nenhum item de breadcrumb intermediario ("Administracao") tera link, seguindo o mesmo padrao de Templates e Agendamentos.
