

# Plano: Redesign do Header - Layout com Grid Definido

## Problema Identificado

O layout atual do preview tem várias falhas:
1. Grid 2x2 com 5 itens deixou DNSSEC sozinho e desalinhado
2. Gaps muito pequenos entre informações (gap-y-1.5)
3. Espaço desperdiçado com o badge "DOMÍNIO"
4. Informações desorganizadas sem estrutura clara

## Nova Abordagem: Grid Tabular Definido

Em vez de tentar encaixar 5 informações em um grid 2x2, vou usar uma **lista vertical estruturada (tabela)** onde cada linha tem label à esquerda e valor à direita, com larguras definidas.

### Estrutura Visual Proposta

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   ┌───────────┐    ┌─────────────────────────────────────────────────────┐  │
│   │           │    │ Domínio ─────────────── brinquedosestrela.com.br   │  │
│   │    79     │    │ SOA ────────────────────── e.sec.dns.br            │  │
│   │  ──────── │    │ Nameservers ─────── e.sec.dns.br, f.sec.dns.br     │  │
│   │  de 100   │    │ SOA Contact ─────── hostmaster@registro.br         │  │
│   │   Bom     │    │ DNSSEC Status ─────────────────── Ativo            │  │
│   │           │    │ Workspace ──────────────────── Cliente XYZ         │  │
│   └───────────┘    └─────────────────────────────────────────────────────┘  │
│                                                                              │
│ ────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│   Total: 23        Aprovadas: 18        Falhas: 5         Alertas: 0        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mudanças Principais

| Aspecto | Antes (Preview Atual) | Depois |
|---------|----------------------|--------|
| Layout Info | Grid 2x2 desbalanceado | Lista vertical com labels fixos |
| Gauge Size | 140px (números apertados) | 160px (melhor legibilidade) |
| Gap entre infos | gap-y-1.5 (muito apertado) | gap-y-2.5 ou espaçamento tabular |
| Alinhamento | Informações flutuando | Colunas definidas (label + valor) |
| Badge "DOMÍNIO" | Presente | Removido |
| Informações | 5 itens em grid 2x2 | 6 itens em lista vertical |

---

## Implementação Técnica

### Arquivo: `src/pages/preview/DomainReportPreview.tsx`

Substituir o grid de informações por uma **tabela estilizada** ou **lista de definições**:

```tsx
{/* Layout Principal */}
<div className="glass-card rounded-xl p-6 border border-primary/20 mb-6">
  <div className="flex flex-col lg:flex-row gap-8">
    
    {/* Score à esquerda - tamanho maior para legibilidade */}
    <div className="flex-shrink-0 flex items-center justify-center">
      <ScoreGauge score={score} size={160} />
    </div>

    {/* Informações em formato tabular */}
    <div className="flex-1 flex flex-col justify-center">
      <div className="space-y-2.5">
        <InfoTableRow label="Domínio" value={domain} highlight />
        <InfoTableRow label="SOA" value={soa} />
        <InfoTableRow label="Nameservers" value={nameservers.join(", ")} />
        <InfoTableRow label="SOA Contact" value={soaContact} />
        <InfoTableRow label="DNSSEC Status" value={dnssec ? "Ativo" : "Inativo"} status={dnssec} />
        <InfoTableRow label="Workspace" value={clientName} />
      </div>
    </div>
  </div>

  {/* Separador e Stats */}
  <div className="border-t border-border/50 my-5" />
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {/* StatCards compactos */}
  </div>
</div>
```

### Novo Componente: InfoTableRow

```tsx
interface InfoTableRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  status?: boolean; // para DNSSEC mostrar cor verde/vermelho
}

function InfoTableRow({ label, value, highlight, status }: InfoTableRowProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground w-28 flex-shrink-0">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/30 max-w-[40px]" />
      <span className={cn(
        "text-sm font-medium flex-1 truncate",
        highlight && "text-primary font-semibold",
        status === true && "text-success",
        status === false && "text-destructive"
      )}>
        {value || "N/A"}
      </span>
    </div>
  );
}
```

Esta estrutura:
- Mantém labels com largura fixa (w-28 = 112px)
- Adiciona linha pontilhada/separador visual entre label e valor
- Permite valores truncarem com ellipsis se muito longos
- Destaca valores importantes com cores

---

## Responsividade

| Viewport | Comportamento |
|----------|---------------|
| Desktop (lg+) | Gauge à esquerda (160px), tabela à direita |
| Tablet/Mobile | Gauge centralizado em cima, tabela abaixo empilhada |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/preview/DomainReportPreview.tsx` | Redesign completo com layout tabular |

---

## Resultado Esperado

Após a atualização, o preview terá:
1. Score legível (160px) sem números esmagados
2. Informações em lista vertical clara e organizada
3. Labels alinhados à esquerda com largura consistente
4. Valores alinhados à direita de cada label
5. Sem espaços vazios no centro
6. Visual limpo e profissional

