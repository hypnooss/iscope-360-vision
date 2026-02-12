
# Redesign de 3 paginas de Administracao (padrao flat)

## Resumo

Aplicar o layout padrao (stats cards compactos, barra de busca, tabela flat sem CardHeader) nas paginas Administradores, Workspaces e Templates. Sem seletor de workspace.

---

## 1. Administradores (`src/pages/AdministratorsPage.tsx`)

### Titulo
- "Administradores" -> "Gerenciamento de Administradores"
- Breadcrumb: `Administracao > Gerenciamento de Administradores`

### Stats cards (4 cards inline via useMemo)
- **Total**: `administrators.length` (icone Users)
- **Super Admin**: contagem com role `super_admin` (icone ShieldCheck)
- **Super Suporte**: contagem com role `super_suporte` (icone HeadsetIcon)
- **Criados este mes**: administradores criados no mes corrente (icone Calendar)

### Barra de busca
- Input com icone Search, placeholder "Buscar administrador..."
- Filtro local por nome ou email

### Tabela flat
- Remover `Card className="glass-card"` com `CardHeader` ("Lista de Administradores")
- Usar `Card` + `CardContent p-0` direto com a tabela
- Colunas e badges mantidos identicos

### Imports a adicionar
- `useMemo`, `Search`, `Users`, `Calendar` do lucide-react

---

## 2. Workspaces (`src/pages/ClientsPage.tsx`)

### Titulo
- "Workspaces" -> "Gerenciamento de Workspaces"
- Breadcrumb: `Administracao > Gerenciamento de Workspaces`

### Stats cards (4 cards inline via useMemo)
- **Total Workspaces**: `clients.length` (icone Building)
- **Total Escopos**: soma de `scopes_count` (icone Globe)
- **Total Agents**: soma de `agents_count` (icone Bot)
- **Sem Escopos**: workspaces com `scopes_count === 0` (icone AlertTriangle)

### Barra de busca
- Input com icone Search, placeholder "Buscar workspace..."
- Filtro local por nome ou descricao

### Tabela flat
- Remover `Card className="glass-card"` com `CardHeader` ("Lista de Workspaces")
- Usar `Card` + `CardContent p-0`
- Manter colunas: Nome, Escopos, Agents, Criado em, Acoes
- Manter dialogs (Create, Edit, Delete, View) inalterados

### Imports a adicionar
- `useMemo`, `Search`, `AlertTriangle`

---

## 3. Templates (`src/pages/admin/TemplatesPage.tsx`)

### Titulo
- "Templates" -> "Gerenciamento de Templates"
- Breadcrumb: `Administracao > Gerenciamento de Templates`

### Stats cards (4 cards inline via useMemo)
- **Total Templates**: `templates.length` (icone Layers)
- **Ativos**: templates com `is_active === true` (icone Activity)
- **Inativos**: templates com `is_active === false` (icone Package)
- **Categorias**: quantidade de categorias distintas (icone Box)

### Barra de busca
- Input com icone Search, placeholder "Buscar template..."
- Filtro local por nome, vendor ou codigo

### Tabela flat
- A tabela ja usa `rounded-md border bg-card` (quase flat), manter esse estilo
- Apenas garantir consistencia visual com as outras paginas

### Manter o componente `TemplatePipelineFlow` entre os stats e a tabela

### Imports a adicionar
- `useMemo`, `Search` do lucide-react, `Input` (ja importado)

---

## Secao tecnica

### Padrao de stats cards (identico em todas as 3 paginas)

```text
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Label</p>
          <p className="text-2xl font-bold">Value</p>
        </div>
      </div>
    </CardContent>
  </Card>
  ...
</div>
```

### Padrao de busca (identico em todas as 3 paginas)

```text
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <Input
    placeholder="Buscar..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-10 max-w-sm"
  />
</div>
```

### Padrao de tabela flat

```text
<Card>
  <CardContent className="p-0">
    <Table>...</Table>
  </CardContent>
</Card>
```

### Funcoes, dialogs e logica existente
Todas as funcoes de CRUD, dialogs de create/edit/delete/view e logica de acesso permanecem **inalteradas**. Apenas o layout visual e reorganizado.

### Arquivos a editar
- `src/pages/AdministratorsPage.tsx`
- `src/pages/ClientsPage.tsx`
- `src/pages/admin/TemplatesPage.tsx`
