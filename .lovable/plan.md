

# Ajustar tela Compliance para o padrao do Analyzer

## Mudancas propostas

### 1. Stats Cards no padrao Analyzer (StatCard com glass-card)

Substituir o componente `ExternalDomainStatsCards` pelos stat cards no estilo do Analyzer: `Card className="glass-card"` com `CardContent className="p-4 flex items-center gap-3"`, icone em div com `bg-muted/50` e texto abaixo (valor grande + label pequeno).

Metricas mantidas:
- Dominios (Globe, text-teal-400)
- Score Medio (TrendingUp, text-blue-400)
- Alertas Criticos (AlertTriangle, text-warning) - score < 50
- Falhas Criticas (Shield, text-destructive) - score < 30

### 2. Remover seletores "Todos os clientes" e "Todos os dominios"

Remover os dois `Select` de filtro (cliente e dominio) da linha de busca. Manter apenas o campo de busca textual.

### 3. Adicionar seletor de Workspace no header

Seguindo exatamente o padrao do Analyzer:
- Usar `useEffectiveAuth` para obter `effectiveRole`
- Buscar lista de clientes (workspaces) do Supabase
- Exibir o seletor com icone `Building2` apenas para roles `super_admin` e `super_suporte`
- Filtrar os dados da tabela pelo workspace selecionado

### 4. Ajustar cores das badges de score na tabela

Usar o padrao de badges com `variant="outline"` e cores consistentes:
- Score >= 75: `bg-teal-500/20 text-teal-400 border-teal-500/30`
- Score >= 50: `bg-warning/20 text-warning border-warning/30`
- Score < 50: `bg-destructive/20 text-destructive border-destructive/30`

### 5. Adicionar coluna "Status Execucao" na tabela

Nova coluna entre "Score" e "Data" que exibe:
- **Pendente**: Badge amarela com texto "Pendente" (quando `status = 'pending'`)
- **Executando**: Badge azul com icone Loader2 animado e texto "Executando" (quando `status = 'running'`)
- **Concluida**: Texto com a data/hora de conclusao formatada (quando `status = 'completed'`)

Para isso, o fetch precisara trazer tambem os campos `status` e `completed_at` de cada analise.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Imports a adicionar**: `Building2`, `useEffectiveAuth`, `useQuery`, `cn`
**Imports a remover**: `ExternalDomainStatsCards`

**Novo estado**: `selectedWorkspaceId` para o seletor de workspace

**Query de workspaces** (copiada do Analyzer):
```text
useQuery para buscar clients (id, name) quando isSuperRole = true
```

**Fetch ajustado**: incluir `status, completed_at` no select da `external_domain_analysis_history` e propagar para as interfaces `DomainReport` e `GroupedDomain.analyses`.

**Stats cards inline**: Substituir `<ExternalDomainStatsCards>` por 4 `StatCard` inline no estilo glass-card do Analyzer (grid 2 colunas mobile, 4 desktop).

**Filtros simplificados**: Manter apenas o `Input` de busca, remover os dois `Select` de cliente/dominio e toda logica associada (`selectedClient`, `selectedDomain`, `availableDomains`, etc).

**Filtragem por workspace**: Quando super role, filtrar dados pelo `selectedWorkspaceId`. Para roles normais, manter o comportamento atual.

**Coluna Status na tabela**: Nova `TableHead` "Status Execucao" e `TableCell` com logica condicional baseada no campo `status` da analise selecionada.

