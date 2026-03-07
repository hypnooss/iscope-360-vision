

## Plano: Filtros interativos por clique nos cards e gráficos

### Objetivo

Permitir que o usuário clique nos 3 cards de resumo (Operacionais, Com Problemas, Eventos Ativos) e nas fatias dos 3 gráficos de pizza (Status, Tipo de Evento, Serviço Afetado) para filtrar a tabela de incidentes. Um clique ativa o filtro, clicar novamente no mesmo item limpa o filtro.

### Alterações em `src/pages/m365/M365ServiceHealthPage.tsx`

**1. Novo estado de filtro**

```ts
const [filter, setFilter] = useState<{ type: string; value: string } | null>(null);
```

Tipos: `'status'`, `'classification'`, `'service'`, `'card'` (para os cards de resumo).

**2. Cards clicáveis**

- Card "Serviços Operacionais": `onClick` → `setFilter({ type: 'card', value: 'operational' })` — sem efeito na tabela (são serviços, não issues), mas pode mostrar visual de seleção
- Card "Com Problemas": `onClick` → `setFilter({ type: 'card', value: 'degraded' })` — filtra issues cujo serviço NÃO é `serviceOperational`
- Card "Eventos Ativos": `onClick` → limpa filtro (mostra todos)
- Adicionar `cursor-pointer`, `ring-2 ring-primary` quando ativo, transição suave

**3. Gráficos de pizza clicáveis**

Adicionar `onClick` handler nas `<Pie>` dos 3 gráficos:
- **Por Status**: filtra issues por `STATUS_CONFIG[status].label === clickedName`
- **Tipo de Evento**: filtra por `classification` (Aviso/Incidente)
- **Serviço Afetado**: filtra por `service === clickedName`

Usar `activeIndex` + `activeShape` para destacar a fatia selecionada.

**4. Tabela filtrada**

```ts
const filteredIssues = useMemo(() => {
  if (!filter) return issues;
  switch (filter.type) {
    case 'status': return issues.filter(i => (STATUS_CONFIG[i.status]?.label || i.status) === filter.value);
    case 'classification': return issues.filter(i => (CLASSIFICATION_LABELS[i.classification] || i.classification) === filter.value);
    case 'service': return issues.filter(i => i.service === filter.value);
    case 'card':
      if (filter.value === 'degraded') {
        const degradedServices = new Set(services.filter(s => s.status !== 'serviceOperational').map(s => s.service));
        return issues.filter(i => degradedServices.has(i.service));
      }
      return issues;
    default: return issues;
  }
}, [issues, services, filter]);
```

**5. Badge de filtro ativo**

Exibir um badge/chip acima da tabela mostrando o filtro ativo com botão "X" para limpar:

```tsx
{filter && (
  <div className="flex items-center gap-2">
    <Badge>Filtro: {filter.value}</Badge>
    <Button variant="ghost" size="icon" onClick={() => setFilter(null)}>
      <X className="w-3 h-3" />
    </Button>
  </div>
)}
```

**6. Atualizar título da tabela** para refletir contagem filtrada: `Incidentes e Avisos (filteredIssues.length)`

### Arquivo

- `src/pages/m365/M365ServiceHealthPage.tsx`

