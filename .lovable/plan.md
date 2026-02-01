
## Plano: Adicionar Botão "Novo Template" e Seleção de Ícone

### Contexto

A página `TemplatesPage.tsx` precisa de duas funcionalidades que existem em `CollectionsPage.tsx`:

1. **Botão para criar novo template** - com modal similar ao de "Nova Tarefa"
2. **Seleção de ícone** - no modal de edição e criação

---

### Alterações em `src/pages/admin/TemplatesPage.tsx`

#### 1. Adicionar Lista de Ícones Disponíveis

```typescript
import * as LucideIcons from 'lucide-react';

const ICON_OPTIONS = [
  'Shield', 'Server', 'Cloud', 'Network', 'Lock', 'Cpu', 
  'HardDrive', 'Wifi', 'Globe', 'Database', 'Monitor', 'Activity',
  'Router', 'Layers', 'Box', 'Package'
];
```

#### 2. Adicionar Helper para Renderizar Ícone Dinâmico

```typescript
const getIconComponent = (iconName: string | null) => {
  if (!iconName) return <Layers className="w-4 h-4" />;
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="w-4 h-4" /> : <Layers className="w-4 h-4" />;
};
```

#### 3. Estado para Modal de Criação

```typescript
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [createForm, setCreateForm] = useState({
  name: '',
  vendor: '',
  code: '',
  category: 'firewall' as DeviceCategory,
  icon: 'Shield',
  is_active: true,
});
```

#### 4. Mutation para Criar Template

```typescript
const createMutation = useMutation({
  mutationFn: async (data: typeof createForm) => {
    const { error } = await supabase
      .from('device_types')
      .insert({
        name: data.name,
        vendor: data.vendor,
        code: data.code,
        category: data.category,
        icon: data.icon,
        is_active: data.is_active,
      });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['device-types-templates'] });
    setCreateDialogOpen(false);
    resetCreateForm();
    toast.success('Template criado com sucesso!');
  },
  onError: (error) => {
    toast.error('Erro ao criar template: ' + error.message);
  },
});
```

#### 5. Botão "Novo Template" no Header

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-foreground">Templates</h1>
    <p className="text-muted-foreground mt-1">
      Gerencie os templates de dispositivos disponíveis no sistema
    </p>
  </div>
  <Button onClick={() => setCreateDialogOpen(true)}>
    <Plus className="w-4 h-4 mr-2" />
    Novo Template
  </Button>
</div>
```

#### 6. Modal de Criação

Adicionar Dialog com campos:
- Fabricante (vendor) *
- Nome *
- Código único * (com transformação para snake_case)
- Categoria (Select)
- Ícone (Select com preview)
- Ativo (Switch)

#### 7. Seleção de Ícone no Modal de Edição

Adicionar campo de seleção de ícone no modal de edição existente:

```tsx
<div className="space-y-2">
  <Label htmlFor="edit-icon">Ícone</Label>
  <Select
    value={editForm.icon || 'Layers'}
    onValueChange={(value) => setEditForm({ ...editForm, icon: value })}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {ICON_OPTIONS.map((icon) => (
        <SelectItem key={icon} value={icon}>
          <div className="flex items-center gap-2">
            {getIconComponent(icon)}
            <span>{icon}</span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

#### 8. Atualizar handleOpenEdit para Incluir Ícone

```typescript
const handleOpenEdit = (template: DeviceType) => {
  setEditingTemplate(template);
  setEditForm({
    name: template.name,
    vendor: template.vendor,
    category: template.category,
    icon: template.icon || 'Layers',
    is_active: template.is_active,
  });
};
```

#### 9. Atualizar handleSaveEdit para Salvar Ícone

```typescript
updateMutation.mutate({
  id: editingTemplate.id,
  updates: {
    name: editForm.name,
    vendor: editForm.vendor,
    category: editForm.category as DeviceType['category'],
    icon: editForm.icon,
    is_active: editForm.is_active,
  },
});
```

#### 10. Usar Ícone Dinâmico na Tabela

Substituir a lógica atual de mapeamento de ícones para usar o ícone salvo no banco:

```tsx
<TableCell>
  <div className="p-1.5 rounded bg-primary/10 w-fit">
    {getIconComponent(template.icon)}
  </div>
</TableCell>
```

---

### Resumo das Alterações

| Item | Descrição |
|------|-----------|
| Import | Adicionar `lucide-react` wildcard e `Plus` |
| Estados | `createDialogOpen`, `createForm` |
| Mutations | `createMutation` |
| Funções | `getIconComponent`, `resetCreateForm` |
| UI | Botão "Novo Template", Modal de criação, Select de ícone no edit |

---

### Resultado Final

A página de Templates terá:
- Botão "Novo Template" no canto superior direito
- Modal de criação com todos os campos incluindo seleção de ícone
- Seleção de ícone no modal de edição
- Ícones dinâmicos na tabela baseados no valor salvo no banco
