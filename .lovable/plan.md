

# Corrigir Layout do TimelineSection: Titulo Dentro da Borda

## Problema

O componente `TimelineSection` atual coloca o titulo (com icone) **fora** do container com borda. Na referencia visual, o icone e titulo fazem parte do **cabecalho interno** do container bordado -- tudo fica dentro de um unico bloco com borda.

## Design da Referencia

Cada bloco tem:
- Uma borda arredondada envolvendo **tudo** (titulo + conteudo)
- O cabecalho (icone + label pequeno + titulo grande) fica na parte superior interna
- A linha vertical conecta os blocos pela lateral esquerda, **entre** os containers

## Solucao

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Refatorar o `TimelineSection` para que o titulo e icone fiquem **dentro** do container com borda:

```typescript
function TimelineSection({ 
  icon: Icon, iconColor, label, title, isLast, children 
}) {
  return (
    <div className="relative">
      {/* Vertical connector line between sections */}
      {!isLast && (
        <div className="absolute left-6 top-full w-0.5 h-4 bg-primary/20 z-0" />
      )}
      {/* Bordered container with header + content inside */}
      <div className="rounded-xl border border-border/60 bg-card/30 mb-4">
        {/* Header row: icon + title */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
          <div className="w-8 h-8 rounded-lg border-2 border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
          <div>
            {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>}
            <h4 className="text-sm font-semibold">{title}</h4>
          </div>
        </div>
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

A linha vertical agora aparece **entre** os containers (do fundo de um ate o topo do proximo), conectando visualmente as secoes.

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `AttackSurfaceAnalyzerPage.tsx` | Refatorar `TimelineSection` para colocar icone e titulo dentro do container bordado, com linha vertical entre blocos |

