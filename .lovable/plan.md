
# Adicionar Editar e Excluir para Firewalls na Tela de Ambiente

## Análise do Estado Atual

Na `EnvironmentPage.tsx`, a seção de Firewalls não passa `renderActions`, então usa o botão padrão "Abrir" (com ícone `ExternalLink`) do componente `AssetCategorySection`.

Os Domínios Externos já têm o padrão correto implementado com `renderActions` customizado (Editar + Excluir com dialog de confirmação).

## O que será feito

### 1. Adicionar estado para exclusão de firewall em `EnvironmentPage.tsx`

Novos estados ao lado dos já existentes para domínios:

```ts
const [deleteFirewallTarget, setDeleteFirewallTarget] = useState<{ id: string; name: string } | null>(null);
const [deleteFirewallLoading, setDeleteFirewallLoading] = useState(false);
```

### 2. Adicionar handler de exclusão de firewall

Baseado no padrão do `FirewallListPage.tsx`:

```ts
const handleDeleteFirewall = useCallback(async () => {
  if (!deleteFirewallTarget) return;
  setDeleteFirewallLoading(true);
  try {
    const { error } = await supabase.from('firewalls').delete().eq('id', deleteFirewallTarget.id);
    if (error) throw error;
    toast.success('Firewall excluído com sucesso');
    queryClient.invalidateQueries({ queryKey: ['environment-assets'] });
    setDeleteFirewallTarget(null);
  } catch (err: any) {
    toast.error('Erro ao excluir firewall: ' + (err.message || 'Erro desconhecido'));
  } finally {
    setDeleteFirewallLoading(false);
  }
}, [deleteFirewallTarget, queryClient]);
```

### 3. Adicionar `renderActions` na seção de Firewalls

Igual ao padrão dos Domínios Externos:

```tsx
<AssetCategorySection
  title="Firewalls"
  ...
  renderActions={(asset) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => navigate(`/scope-firewall/firewalls/${asset.id}/edit`)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => setDeleteFirewallTarget({ id: asset.id, name: asset.name })}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )}
/>
```

### 4. Adicionar o dialog de confirmação de exclusão para firewalls

Reutilizando o mesmo `DeleteEnvironmentDomainDialog` já importado, com texto adaptado (ou criar um componente genérico). Mais simples: reutilizar o mesmo dialog existente passando o nome do firewall.

## Arquivo Alterado

- `src/pages/EnvironmentPage.tsx` — único arquivo a modificar

## Resumo

| Item | Ação |
|---|---|
| Botão "Abrir" nos Firewalls | Removido (substituído por `renderActions`) |
| Botão Editar nos Firewalls | Adicionado — navega para `/scope-firewall/firewalls/:id/edit` |
| Botão Excluir nos Firewalls | Adicionado — abre dialog de confirmação com código |
| Dialog de confirmação | Reutiliza `DeleteEnvironmentDomainDialog` com texto de firewall |
