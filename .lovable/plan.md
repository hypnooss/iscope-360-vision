

# Separadores Visuais com Linha Vertical nos Cards Expandidos do Attack Surface Analyzer

## Objetivo

Adaptar o layout dos tres topicos expandidos (Portas Abertas, Servicos e Tecnologias, Certificados TLS) no `AssetCard` para usar bordas ao redor de cada secao e uma linha vertical conectando-as, inspirado no design de referencia (print 2).

## Design

Cada secao sera envolvida por uma borda arredondada com uma barra colorida no topo (similar ao print 2). Uma linha vertical conectara as secoes, criando um visual de "timeline" ou "pipeline".

```text
  |
  +-- [ Portas Abertas (1) ]
  |   [ 443 ]
  |
  +-- [ Servicos & Tecnologias ]
  |   [ Apache httpd ... ]
  |
  +-- [ Certificados TLS (1) ]
      [ clientes.novvsgj1... ]
```

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### 1. Criar componente `TimelineSection`

Um wrapper reutilizavel que renderiza cada secao com:
- Uma linha vertical a esquerda (borda `border-l-2` com cor primaria)
- Um conector horizontal (bolinha ou traco) ligando a linha ao titulo
- Uma borda ao redor do conteudo da secao

```typescript
function TimelineSection({ 
  icon: Icon, 
  iconColor, 
  title, 
  isLast, 
  children 
}: { 
  icon: React.ElementType; 
  iconColor: string; 
  title: string; 
  isLast?: boolean; 
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-4">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-lg border-2 border-primary/40 bg-primary/10",
          "flex items-center justify-center shrink-0 z-10"
        )}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-primary/20 min-h-[16px]" />
        )}
      </div>
      {/* Content card */}
      <div className="flex-1 pb-6">
        <h4 className="text-sm font-medium mb-3">{title}</h4>
        <div className="rounded-xl border border-border/60 bg-card/30 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

#### 2. Refatorar a area expandida do `AssetCard`

Substituir os tres blocos (Portas, Servicos, Certificados) pelo uso do `TimelineSection`:

```typescript
{open && (
  <div className="border-t border-border/50 py-6 pr-4 pl-10 bg-muted/10">
    {asset.ports.length > 0 && (
      <TimelineSection
        icon={Server}
        iconColor="text-orange-400"
        title={`Portas Abertas (${asset.ports.length})`}
        isLast={
          asset.services.length === 0 && 
          asset.webServices.length === 0 && 
          asset.tlsCerts.length === 0
        }
      >
        {/* port badges */}
      </TimelineSection>
    )}
    
    {(asset.services.length > 0 || asset.webServices.length > 0) && (
      <TimelineSection
        icon={Globe}
        iconColor="text-primary"
        title="Serviços & Tecnologias"
        isLast={asset.tlsCerts.length === 0}
      >
        {/* service rows */}
      </TimelineSection>
    )}

    {asset.tlsCerts.length > 0 && (
      <TimelineSection
        icon={Shield}
        iconColor="text-primary"
        title={`Certificados TLS (${asset.tlsCerts.length})`}
        isLast={true}
      >
        {/* cert rows */}
      </TimelineSection>
    )}
  </div>
)}
```

O conteudo interno de cada secao (badges de portas, `NmapServiceRow`, `WebServiceRow`, `OrphanCVEsBlock`, rows de certificados) permanece inalterado, apenas e movido para dentro do `TimelineSection`.

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `AttackSurfaceAnalyzerPage.tsx` | Criar `TimelineSection`, refatorar a area expandida do `AssetCard` para usar timeline com bordas e linha vertical |

