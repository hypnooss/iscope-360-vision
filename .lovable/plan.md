
# Plano: Opção 2 - Score Integrado (com Preview Temporário)

## Estratégia de Segurança

Criaremos uma página de preview temporária em `/preview/domain-report` que usa dados mockados. Isso permite:
1. Ver o novo layout sem afetar a página funcional
2. Testar diferentes ajustes sem risco
3. Aprovar antes de aplicar na página real

---

## Arquivos a Criar

### 1. `src/pages/preview/DomainReportPreview.tsx` (NOVO)

Página de preview com dados mockados e o novo layout da Opção 2.

---

## Arquivos a Modificar

### 2. `src/App.tsx`

Adicionar rota temporária para preview:
```typescript
// Adicionar import
const DomainReportPreview = lazy(() => import("./pages/preview/DomainReportPreview"));

// Adicionar rota (antes do catch-all)
<Route path="/preview/domain-report" element={<DomainReportPreview />} />
```

---

## Novo Layout - Opção 2 (Score Integrado)

O novo design consolida tudo em um único card:

### Estrutura Visual

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────┐                                                                │
│  │          │                                                                │
│  │    79    │   🌐 Domínio          brinquedosestrela.com.br                │
│  │  ──────  │   📡 SOA              e.sec.dns.br                            │
│  │  de 100  │   🔒 Nameservers      e.sec.dns.br, f.sec.dns.br              │
│  │   Bom    │   📧 SOA Contact      hostmaster@registro.br                  │
│  │          │   🛡️ DNSSEC           Ativo                                   │
│  └──────────┘                                                                │
│                                                                              │
│ ─────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Total     │  │  Aprovadas  │  │   Falhas    │  │   Alertas   │         │
│  │     23      │  │     18      │  │      5      │  │      0      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mudanças Principais

| Antes | Depois |
|-------|--------|
| Grid 1x3 (Gauge 1/3 + Info 2/3) | Card único com flex row |
| ScoreGauge size=200 (default) | ScoreGauge size=140 |
| Info colada nas bordas | Info com padding e gaps maiores |
| Badge "DOMÍNIO" grande (w-24 h-24) | Removido (integrado ao score) |
| Espaço central vazio | Informações alinhadas à direita do score |

### Código do Novo Layout

```tsx
{/* Score Integrado - Card Único */}
<div className="glass-card rounded-xl p-6 border border-primary/20 mb-6">
  <div className="flex flex-col lg:flex-row gap-6">
    
    {/* Score compacto à esquerda */}
    <div className="flex-shrink-0 flex items-center justify-center lg:justify-start">
      <ScoreGauge score={79} size={140} />
    </div>
    
    {/* Informações centrais */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <InfoRow icon={<Globe />} label="Domínio" value="brinquedosestrela.com.br" />
        <InfoRow icon={<Server />} label="SOA" value="e.sec.dns.br" />
        <InfoRow icon={<Network />} label="Nameservers" value="e.sec.dns.br, f.sec.dns.br" />
        <InfoRow icon={<Mail />} label="SOA Contact" value="hostmaster@registro.br" />
        <InfoRow icon={<Shield />} label="DNSSEC" value="Ativo" />
      </div>
    </div>
  </div>
  
  {/* Separador */}
  <div className="border-t border-border/50 my-5" />
  
  {/* Stats horizontais */}
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <StatCard title="Total" value={23} icon={ListChecks} variant="default" compact />
    <StatCard title="Aprovadas" value={18} icon={CheckCircle2} variant="success" compact />
    <StatCard title="Falhas" value={5} icon={ShieldX} variant="destructive" compact />
    <StatCard title="Alertas" value={0} icon={AlertTriangle} variant="warning" compact />
  </div>
</div>
```

---

## Melhorias Específicas

### 1. Score Menor e Integrado
- Tamanho reduzido de 200px para 140px
- Alinhado à esquerda no desktop, centralizado no mobile
- Remove o card separado do gauge

### 2. Informações com Mais Espaço
- `gap-y-3` ao invés de `gap-y-1.5` (dobro do espaçamento vertical)
- `gap-x-8` ao invés de `gap-x-6` (mais espaço horizontal)
- Padding geral `p-6` (era `p-5`)

### 3. Badge "DOMÍNIO" Removido
- O contexto já é claro pelo título da página
- Economiza ~100px de largura

### 4. Stats Mantidos Abaixo
- Aproveitam toda a largura do card
- Separados por borda sutil

---

## Responsividade

| Viewport | Comportamento |
|----------|---------------|
| Desktop (lg+) | Score à esquerda, Info à direita, Stats abaixo |
| Tablet (sm-lg) | Score centralizado em cima, Info abaixo, Stats 2x2 |
| Mobile (<sm) | Tudo empilhado verticalmente |

---

## Fluxo de Teste

1. Criar página de preview com dados mockados
2. Acessar `/preview/domain-report`
3. Revisar e ajustar conforme feedback
4. Se aprovado, aplicar na página real
5. Remover rota e arquivo de preview

---

## Resultado Esperado

Após implementar, você poderá:
1. Acessar `/preview/domain-report` no browser
2. Ver o novo layout com dados de exemplo
3. Comparar lado a lado com a página atual
4. Solicitar ajustes sem afetar nada funcional
