
# Redesign Completo: Header de Relatório Universal

## Visão Criativa

Após analisar dezenas de dashboards de cybersecurity modernos, identifiquei um padrão que diferencia os melhores: **hierarquia visual forte com destaque ao indicador principal** e **uso de cores para comunicar estado, não decoração**.

O novo design será **completamente diferente** do atual - inspirado nos melhores exemplos de Dribbble/Behance, mas adaptado ao contexto Precisio.

---

## Conceito: "Command Center Header"

Em vez de um card com informações espalhadas, vou criar um **painel de comando** que comunica instantaneamente:

1. **O quê** está sendo analisado (domínio/firewall)
2. **Como** está (score visual dominante)
3. **Resumo executivo** (stats de impacto)

---

## Estrutura Visual

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                     │ │
│  │    B R I N Q U E D O S E S T R E L A . C O M . B R                                 │ │
│  │    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                      │ │
│  │                                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  ┌───────────────────────────────┐  ┌────────────────────────────────────────────────┐  │
│  │                               │  │                                                │  │
│  │         ╭───────────╮         │  │  SOA Primary        e.sec.dns.br               │  │
│  │        ╱             ╲        │  │  ──────────────────────────────────            │  │
│  │       │      79       │       │  │  Nameservers        e.sec.dns.br               │  │
│  │       │    ─────      │       │  │                     f.sec.dns.br               │  │
│  │       │    de 100     │       │  │  ──────────────────────────────────            │  │
│  │        ╲     Bom     ╱        │  │  SOA Contact        hostmaster@registro.br     │  │
│  │         ╰───────────╯         │  │  ──────────────────────────────────            │  │
│  │                               │  │  DNSSEC             ● Ativo                    │  │
│  │    ┌─────┐ ┌─────┐ ┌─────┐   │  │  ──────────────────────────────────            │  │
│  │    │ 23  │ │ 18  │ │  5  │   │  │  Workspace          Brinquedos Estrela S/A     │  │
│  │    │Total│ │Pass │ │Fail │   │  │                                                │  │
│  │    └─────┘ └─────┘ └─────┘   │  │                                                │  │
│  │                               │  │                                                │  │
│  └───────────────────────────────┘  └────────────────────────────────────────────────┘  │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Elementos Principais

### 1. Faixa de Identificação (Novo)

Título principal do alvo em **destaque máximo**:
- Fonte grande (text-2xl ou text-3xl)
- Letter-spacing expandido para visual "tech"
- Underline gradiente sutil
- Remove ambiguidade: o usuário sabe imediatamente O QUE está vendo

```tsx
<div className="text-center mb-6">
  <h2 className="text-2xl font-bold tracking-widest text-foreground uppercase">
    {domain}
  </h2>
  <div className="h-0.5 w-32 mx-auto mt-2 bg-gradient-to-r from-transparent via-primary to-transparent" />
</div>
```

### 2. Painel Esquerdo: Score + Stats Integrados

Gauge maior (180px) com mini-stats abaixo em linha horizontal:

```tsx
<div className="flex flex-col items-center">
  <ScoreGauge score={79} size={180} />
  
  <div className="flex gap-4 mt-4">
    <MiniStat value={23} label="Total" />
    <MiniStat value={18} label="Pass" variant="success" />
    <MiniStat value={5} label="Fail" variant="destructive" />
  </div>
</div>
```

O **MiniStat** é um novo componente ultra-compacto:
```tsx
function MiniStat({ value, label, variant }) {
  return (
    <div className="text-center">
      <span className={cn("text-lg font-bold tabular-nums", variantColor[variant])}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground block">{label}</span>
    </div>
  );
}
```

### 3. Painel Direito: Informações Estruturadas

Lista vertical com separadores visuais claros:

```tsx
<div className="space-y-3">
  <DetailRow label="SOA Primary" value={soa} />
  <DetailRow label="Nameservers" value={nameservers} multiline />
  <DetailRow label="SOA Contact" value={soaContact} />
  <DetailRow label="DNSSEC" value="Ativo" indicator="success" />
  <DetailRow label="Workspace" value={clientName} />
</div>
```

O **DetailRow** é elegante e consistente:
```tsx
function DetailRow({ label, value, indicator, multiline }) {
  return (
    <>
      <div className="flex items-start gap-4">
        <span className="text-sm text-muted-foreground w-28 flex-shrink-0">
          {label}
        </span>
        <div className="flex-1">
          {indicator && (
            <span className={cn("inline-block w-2 h-2 rounded-full mr-2", indicatorColors[indicator])} />
          )}
          {multiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div key={i} className="text-sm font-medium text-foreground">{v}</div>
              ))}
            </div>
          ) : (
            <span className="text-sm font-medium text-foreground">{value}</span>
          )}
        </div>
      </div>
      <div className="border-b border-border/30" />
    </>
  );
}
```

---

## Adaptabilidade para Outros Módulos

O design é **genérico por natureza**:

| Módulo | Título Principal | Detalhes |
|--------|-----------------|----------|
| Domínio Externo | `brinquedosestrela.com.br` | SOA, NS, DNSSEC, Contact |
| Firewall | `FortiGate-HQ` | Firmware, Modelo, Serial, Uptime |
| Entra ID | `contoso.onmicrosoft.com` | Tenant ID, Licenças, MFA Status |

A estrutura permanece idêntica, apenas os campos mudam.

---

## Paleta e Estilo

- **Background**: Card com gradiente sutil (usando `--gradient-card`)
- **Borda**: Linha fina com cor primária (`border-primary/20`)
- **Glow sutil**: Box-shadow com cor primária em baixa opacidade
- **Separadores**: Linhas com `border-border/30` para leveza

---

## Componentes a Criar

| Componente | Descrição |
|------------|-----------|
| `ReportHeader` | Container principal reutilizável |
| `MiniStat` | Stat ultra-compacto (valor + label) |
| `DetailRow` | Linha de detalhe com label e valor |

---

## Responsividade

| Viewport | Comportamento |
|----------|---------------|
| Desktop (lg+) | Dois painéis lado a lado |
| Tablet (md-lg) | Painéis empilhados, gauge centralizado |
| Mobile (<md) | Tudo empilhado, gauge 140px |

---

## Arquivo a Modificar

`src/pages/preview/DomainReportPreview.tsx`

Vou reescrever completamente com o novo conceito "Command Center".

---

## Resultado Esperado

Um header que:
1. Identifica claramente o alvo da análise
2. Comunica o score de forma impactante
3. Organiza informações de maneira profissional
4. Funciona para qualquer tipo de relatório
5. Parece um produto de cybersecurity moderno e premium
