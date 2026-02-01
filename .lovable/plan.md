

## Reformulação da Visualização de Blueprints

### Situação Atual

- Blueprints exibidos em tabela compacta (Nome | Versão | Steps | Status | Ações)
- Botão "Visualizar" (Eye) abre um dialog modal para ver o JSON
- Usuário precisa de 2 cliques para ver o conteúdo

### Nova Estrutura Proposta

Substituir a tabela por **cards expandidos** que mostram todas as informações diretamente:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  BLUEPRINTS                                                                │
│  Configure os blueprints de coleta de dados para esta tarefa.  [+ Novo]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  External DNS Collection                                            │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │  Coleta informações DNS para análise de compliance                  │  │
│  │                                                                      │  │
│  │  Versão: any     Steps: 7     [Ativo]                               │  │
│  │                                                                      │  │
│  │  ┌─ Collection Steps ───────────────────────────────────────────┐   │  │
│  │  │  {                                                            │   │  │
│  │  │    "steps": [                                                 │   │  │
│  │  │      { "id": "ns_records", "executor": "dns_query", ... },   │   │  │
│  │  │      { "id": "mx_records", "executor": "dns_query", ... },   │   │  │
│  │  │      ...                                                      │   │  │
│  │  │    ]                                                          │   │  │
│  │  │  }                                                            │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │                                    [Duplicar] [Editar] [Excluir]    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Backup Blueprint                                          [Inativo] │  │
│  │  ...                                                                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Alterações no Código

**Arquivo:** `src/components/admin/BlueprintsTable.tsx`

#### 1. Remover o Dialog de Visualização
- Remover estado `viewDialogOpen`
- Remover função `openViewDialog`
- Remover o componente `Dialog` de visualização (linhas 366-395)
- Remover botão de "Visualizar" (Eye) da tabela

#### 2. Substituir Tabela por Cards
- Trocar `<Table>` por uma lista de cards
- Cada card mostra:
  - Header: Nome + Badge de status (Ativo/Inativo)
  - Descrição (se houver)
  - Metadados: Versão e contagem de steps
  - ScrollArea com JSON formatado
  - Footer: Botões de ação (Duplicar, Editar, Excluir)

#### 3. Estrutura do Card

```tsx
{blueprints.map((blueprint) => (
  <div key={blueprint.id} className="border rounded-lg border-border/50 p-4 space-y-4">
    {/* Header */}
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-medium">{blueprint.name}</h4>
        {blueprint.description && (
          <p className="text-sm text-muted-foreground mt-1">{blueprint.description}</p>
        )}
      </div>
      <Badge variant={blueprint.is_active ? 'default' : 'secondary'}>
        {blueprint.is_active ? 'Ativo' : 'Inativo'}
      </Badge>
    </div>
    
    {/* Metadados */}
    <div className="flex items-center gap-4 text-sm">
      <span>Versão: <code className="bg-muted px-2 py-0.5 rounded">{blueprint.version}</code></span>
      <Badge variant="outline">{getStepsCount(blueprint)} steps</Badge>
    </div>
    
    {/* JSON Content */}
    <ScrollArea className="h-[200px] rounded-md border border-border/50 bg-muted/30 p-3">
      <pre className="text-xs font-mono">
        {JSON.stringify(blueprint.collection_steps, null, 2)}
      </pre>
    </ScrollArea>
    
    {/* Actions */}
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => handleDuplicate(blueprint)}>
        <Copy className="w-4 h-4 mr-2" />
        Duplicar
      </Button>
      <Button variant="outline" size="sm" onClick={() => openEditDialog(blueprint)}>
        <Pencil className="w-4 h-4 mr-2" />
        Editar
      </Button>
      <Button variant="outline" size="sm" onClick={() => openDeleteDialog(blueprint)} className="text-destructive">
        <Trash2 className="w-4 h-4 mr-2" />
        Excluir
      </Button>
    </div>
  </div>
))}
```

---

### Resumo das Alterações

| Ação | Descrição |
|------|-----------|
| Remover | Dialog de visualização e botão Eye |
| Remover | Componente Table |
| Adicionar | Cards com conteúdo JSON inline |
| Manter | Dialog de criação/edição |
| Manter | Dialog de confirmação de exclusão |
| Manter | Toda lógica de CRUD existente |

---

### Benefícios

1. **Visualização imediata** - JSON visível sem cliques extras
2. **Menos modais** - Interface mais limpa
3. **Contexto completo** - Todas as informações do blueprint em um só lugar
4. **Consistência** - Similar ao estilo do Fluxo de Análise

