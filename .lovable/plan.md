

# Administracao > CVEs - Painel centralizado do cache de CVEs

## Objetivo

Criar uma nova pagina administrativa em `/cves` que exibe o conteudo da tabela `cve_severity_cache`, seguindo o mesmo padrao visual da pagina de Agendamentos (`/schedules`).

## O que existe hoje (resumo do sistema de CVEs)

- **Tabela `cve_severity_cache`**: armazena contagens de CVEs por severidade (critical, high, medium, low, total_cves), top 2 CVEs, modulo (firewall/m365) e client_id
- **Edge Function `refresh-cve-cache`**: executa diariamente as 06:00 UTC via cron, consulta NIST NVD (firewalls) e MSRC (M365) e popula o cache
- **Paginas por modulo**: `/scope-firewall/cves` e `/scope-m365/cves` buscam dados ao vivo das APIs
- **Dashboard**: usa o cache via `useTopCVEs` para exibir alertas prioritarios

## Pagina nova: `/cves` (Administracao > CVEs)

### Layout (espelhando SchedulesPage)

1. **Breadcrumb**: Administracao > CVEs
2. **Header**: titulo "CVEs" + subtitulo "Cache centralizado de vulnerabilidades por modulo"
3. **Cards de resumo** (4 cards):
   - Total de CVEs (soma de todos os registros)
   - Criticos (soma de `critical`)
   - Altos (soma de `high`)
   - Ultima atualizacao (data mais recente de `updated_at`)
4. **Filtros**: busca por workspace (client name), filtro por modulo (firewall/m365/todos)
5. **Tabela** com colunas:
   - Modulo (firewall / m365)
   - Workspace (nome do client, ou "Global" quando client_id e null)
   - Criticos / Altos / Medios / Baixos / Total
   - Top CVEs (badges com ID e score)
   - Ultima Atualizacao (tempo relativo)

### Dados

A query busca de `cve_severity_cache` com join em `clients` para resolver o nome do workspace:

```sql
SELECT c.*, clients.name as client_name
FROM cve_severity_cache c
LEFT JOIN clients ON c.client_id = clients.id
ORDER BY c.updated_at DESC
```

### Navegacao

Adicionar item "CVEs" no menu de Administracao (sidebar) com icone `Bug`, na mesma posicao apos "Agendamentos".

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/pages/admin/CVEsCachePage.tsx` | Criar - pagina completa seguindo padrao SchedulesPage |
| `src/App.tsx` | Modificar - adicionar lazy import e rota `/cves` |
| `src/components/layout/AppLayout.tsx` | Modificar - adicionar item "CVEs" no menu admin (desktop, collapsed e mobile) |

## Detalhes tecnicos

- Usa `useQuery` com `queryKey: ['admin-cve-cache']` e `refetchInterval: 60_000`
- Resolve `client_id` para nome via join no select do Supabase: `.select('*, clients(name)')`
- Quando `client_id` e null (M365 global), exibe "Global" na coluna Workspace
- Top CVEs renderizados como badges clicaveis que abrem o NVD em nova aba
- Nenhuma alteracao no banco de dados necessaria (tabela `cve_severity_cache` ja existe com RLS adequado)

