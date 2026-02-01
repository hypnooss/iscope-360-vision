

## Reformulação do Blueprint Flow Visualization

### Problemas Identificados

1. **Excesso de aninhamento**: Cards dentro de cards dentro de tabelas dentro de accordions
2. **Cores inadequadas para dark mode**: O card do step (print 2) usa `bg-cyan-50` com texto escuro, que em dark mode fica praticamente invisível
3. **Layout horizontal confuso**: Step → Seta → Regras lado a lado consome muito espaço horizontal e fica apertado
4. **Informação densa demais**: Cada regra mostra código, badge, nome, categoria E lógica de avaliação tudo ao mesmo tempo

### Nova Estrutura Proposta

Substituir o layout horizontal por um **layout vertical em timeline**, mais limpo e legível:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 7 steps de coleta  •  23 regras de compliance  •  23 ativas         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ COLETA ──────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ● ns_records                                                       │ │
│  │    DNS Query • Consulta NS                                          │ │
│  │                                                                     │ │
│  │    Regras: DNS-003 (Médio) • DNS-004 (Médio)                       │ │
│  │                                                                     │ │
│  ├─────────────────────────────────────────────────────────────────────│ │
│  │                                                                     │ │
│  │  ● mx_records                                                       │ │
│  │    DNS Query • Consulta MX                                          │ │
│  │                                                                     │ │
│  │    Regras: MX-001 (Alto) • MX-002 (Médio) • MX-003 (Baixo) • +1    │ │
│  │                                                                     │ │
│  ├─────────────────────────────────────────────────────────────────────│ │
│  │                                                                     │ │
│  │  ● spf_record                                                       │ │
│  │    DNS Query • Consulta TXT (SPF)                                   │ │
│  │                                                                     │ │
│  │    Regras: SPF-001 (Alto) • SPF-002 (Médio) • SPF-003 (Médio)      │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Características do Novo Design

1. **Layout Vertical em Lista**
   - Cada step é uma linha/item na lista
   - Menos aninhamento visual
   - Mais espaço para respirar

2. **Cores Adaptadas ao Dark Mode**
   - Usar variáveis CSS do tema (`bg-card`, `border-border`, `text-foreground`)
   - Badges de severidade com cores já padronizadas no projeto
   - Indicadores de tipo de executor com cores sutis (borda esquerda colorida apenas)

3. **Regras Compactas Inline**
   - Exibir regras como badges/chips em linha única
   - Mostrar código + severidade em formato compacto
   - Expandir detalhes apenas ao clicar

4. **Interação Opcional**
   - Hover para ver mais detalhes do step
   - Clique opcional para expandir e ver todas as regras

### Implementação Técnica

**Arquivo a modificar:** `src/components/admin/BlueprintFlowVisualization.tsx`

```typescript
// Novo design: lista vertical simples
<div className="space-y-2">
  {steps.map((step) => (
    <div 
      key={step.id}
      className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
    >
      {/* Indicador visual do tipo de executor */}
      <div className={cn(
        "w-1 self-stretch rounded-full",
        executorColors[step.executor] // Apenas borda colorida
      )} />
      
      <div className="flex-1 min-w-0">
        {/* Nome do Step + Tipo */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-medium text-foreground">
            {step.id}
          </span>
          <Badge variant="outline" className="text-xs">
            {executorLabel[step.executor]}
          </Badge>
        </div>
        
        {/* Descrição/Config */}
        <p className="text-xs text-muted-foreground mb-2">
          {getStepDescription(step)}
        </p>
        
        {/* Regras em linha */}
        <div className="flex flex-wrap gap-1.5">
          {linkedRules.map((rule) => (
            <Badge 
              key={rule.id}
              className={cn(
                "text-xs cursor-default",
                severityColors[rule.severity]
              )}
              title={rule.name}
            >
              {rule.code}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  ))}
</div>
```

### Paleta de Cores (Dark Mode Friendly)

| Elemento | Cor Atual (Problema) | Nova Cor |
|----------|---------------------|----------|
| Card do Step | `bg-cyan-50` (invisível em dark) | `bg-card` (tema) |
| Texto do Step | `text-foreground` | `text-foreground` (ok) |
| Borda esquerda DNS | `border-cyan-300` | `bg-cyan-500` |
| Borda esquerda HTTP | `border-blue-300` | `bg-blue-500` |
| Borda esquerda SSH | `border-emerald-300` | `bg-emerald-500` |
| Badge Crítico | `bg-red-100 text-red-600` | `bg-red-500/20 text-red-400` |
| Badge Alto | `bg-orange-100 text-orange-600` | `bg-orange-500/20 text-orange-400` |
| Badge Médio | `bg-yellow-100 text-yellow-600` | `bg-yellow-500/20 text-yellow-400` |
| Badge Baixo | `bg-blue-100 text-blue-600` | `bg-blue-500/20 text-blue-400` |

### Opcional: Modo Expandido

Adicionar um toggle para alternar entre:
- **Modo Compacto** (padrão): Lista vertical com regras inline
- **Modo Detalhado**: Expande para mostrar lógica de avaliação de cada regra

### Resumo das Alterações

1. **`src/components/admin/BlueprintFlowVisualization.tsx`**
   - Reescrever layout de horizontal para vertical
   - Atualizar cores para funcionar em dark mode
   - Simplificar exibição de regras (badges inline)
   - Remover cards aninhados
   - Adicionar tooltip com detalhes das regras

2. **Benefícios**
   - Menos aninhamento = mais clareza visual
   - Cores visíveis em dark mode
   - Informação hierárquica e escaneável
   - Mais espaço para respirar entre elementos

