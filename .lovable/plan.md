

# Remover opcao "Todos os Workspaces" do Dashboard

## Resumo

Remover a opcao "Todos os workspaces" do seletor no Dashboard Geral, que causa lentidao por agregar dados de todos os workspaces simultaneamente. O seletor passara a auto-selecionar o primeiro workspace disponivel ao carregar.

## Mudancas

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

1. **Auto-selecionar primeiro workspace**: Adicionar logica no `useEffect` que busca workspaces para automaticamente definir `selectedWorkspaceId` com o primeiro resultado (mesmo padrao ja usado no Attack Surface Analyzer).

2. **Remover opcao "all"**: Retirar o `<SelectItem value="all">Todos os workspaces</SelectItem>` do seletor.

3. **Remover logica de "all"**: Alterar o `onValueChange` para nao converter `"all"` em `null`. O valor sera sempre um ID de workspace valido.

4. **Bloquear carregamento sem workspace**: O `useDashboardStats` so sera chamado com um `selectedWorkspaceId` definido, evitando queries sem filtro.

### Arquivo: `src/hooks/useDashboardStats.ts`

Nenhuma mudanca necessaria. O hook ja aceita `selectedWorkspaceId` e filtra corretamente quando fornecido.

## Secao tecnica

### Logica de auto-selecao (padrao existente)

```text
useEffect(() => {
  if (!isSuperRole) return;
  const fetchWorkspaces = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    if (data && data.length > 0) {
      setWorkspaces(data);
      setSelectedWorkspaceId(data[0].id);  // auto-seleciona o primeiro
    }
  };
  fetchWorkspaces();
}, [isSuperRole]);
```

### Seletor sem opcao "all"

```text
<Select
  value={selectedWorkspaceId ?? ''}
  onValueChange={(v) => setSelectedWorkspaceId(v)}
>
  <SelectTrigger className="w-[220px] bg-background">
    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
    <SelectValue placeholder="Selecione um workspace" />
  </SelectTrigger>
  <SelectContent className="bg-popover">
    {workspaces.map((ws) => (
      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Arquivos a editar
- `src/pages/GeneralDashboardPage.tsx`

