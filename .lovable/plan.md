

## Separação: Fluxo de Análise (Visualização) vs Organização (Configuração)

### Problema Identificado
Ao substituir o componente `BlueprintFlowVisualization` pelo `DraggableCategoryFlow`, perdemos a capacidade de visualizar detalhes importantes dos itens:
- Descrição da regra
- Lógica de avaliação
- Step de coleta vinculado
- Parses/traduções utilizados

### Solução Proposta
Separar as funcionalidades em duas abas distintas:

| Aba | Propósito | Componente |
|-----|-----------|------------|
| **Fluxo de Análise** | Visualização detalhada (original) | `BlueprintFlowVisualization` |
| **Organização** (nova) | Configuração visual e reorganização | `DraggableCategoryFlow` + configs |

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/admin/TemplateDetailPage.tsx` | Adicionar nova aba "Organização" |
| `src/components/admin/BlueprintFlowVisualization.tsx` | Remover CategoryConfigPopover (voltar ao original) |
| `src/components/admin/DraggableCategoryFlow.tsx` | Manter como está (para aba Organização) |

---

### Nova Estrutura de Abas

```
Tabs:
├── Fluxo de Análise    ← Visualização detalhada (RuleFlowCard expansível)
├── Organização         ← NOVA: Drag-and-drop + configuração de cores/ícones/ordem
├── Blueprints
├── Regras
└── Parses
```

---

### Detalhes da Implementação

#### 1. Reverter Aba "Fluxo de Análise"

Usar o componente `BlueprintFlowVisualization` original, removendo o `CategoryConfigPopover` do cabeçalho das categorias. Esta aba volta a ser **somente visualização**.

**Antes (atual):**
```tsx
<TabsContent value="flow">
  <DraggableCategoryFlow ... />  // ❌ Perdeu detalhes
</TabsContent>
```

**Depois:**
```tsx
<TabsContent value="flow">
  <BlueprintFlowVisualization ... />  // ✅ Visualização completa
</TabsContent>
```

#### 2. Nova Aba "Organização"

Adicionar uma nova aba que concentra todas as funcionalidades de configuração:

```tsx
<TabsTrigger value="organize" className="gap-2">
  <Settings className="w-4 h-4" />
  Organização
</TabsTrigger>

<TabsContent value="organize">
  <DraggableCategoryFlow
    blueprint={activeBlueprint}
    rules={rules}
    deviceTypeId={id}
    onRulesChange={refetchRules}
  />
</TabsContent>
```

#### 3. Limpar BlueprintFlowVisualization

Remover a referência ao `CategoryConfigPopover` do componente de visualização, já que a configuração agora fica em outra aba:

```tsx
// AdminCategorySection - remover:
{deviceTypeId && (
  <CategoryConfigPopover ... />  // ❌ Remover
)}
```

---

### Resultado Final

| Aba | Funcionalidade |
|-----|----------------|
| **Fluxo de Análise** | Ver regras expandidas com descrição, lógica, steps e parses |
| **Organização** | Arrastar regras entre categorias, criar categorias, configurar cores/ícones/ordem, excluir categorias vazias |
| Blueprints | Gerenciar blueprints de coleta |
| Regras | CRUD de regras de compliance |
| Parses | CRUD de traduções de evidências |

---

### Vantagens

1. **Separação de responsabilidades**: Visualizar vs Configurar
2. **Restaura funcionalidade perdida**: Detalhes completos dos itens voltam a aparecer
3. **Interface mais clara**: Usuário sabe onde fazer cada ação
4. **Menor risco de erros**: Drag-and-drop isolado evita cliques acidentais

