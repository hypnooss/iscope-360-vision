

## Ajustes Visuais no Mapa DNS

### Resumo das Alterações

1. **Fundo do card DNS Map** - Aplicar o mesmo estilo visual do card de informações (gradient escuro + grid pattern)
2. **Globo visível atrás do domínio** - Tornar o card do domínio transparente para o globo aparecer
3. **IPs dos registros NS** - Buscar e exibir IPs resolvidos dos nameservers
4. **Filtro padrão de subdomínios** - Iniciar com "ativos" selecionado
5. **Tamanho das fontes** - Aumentar fontes das informações secundárias

---

### Detalhes Técnicos

#### 1. Fundo do Card DNS Map

**Problema:** O DNS Map usa `glass-card` (bg-card/80), enquanto o card de informações usa gradient escuro com grid pattern.

**Solução:** Aplicar o mesmo estilo do Command Center Header:

```tsx
// Antes
<Card className={cn("glass-card border-border/50", className)}>

// Depois
<div 
  className={cn(
    "relative overflow-hidden rounded-2xl border border-primary/20",
    className
  )}
  style={{
    background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))"
  }}
>
  {/* Grid pattern overlay */}
  <div 
    className="absolute inset-0 opacity-30 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(hsl(175 80% 45% / 0.03) 1px, transparent 1px),
        linear-gradient(90deg, hsl(175 80% 45% / 0.03) 1px, transparent 1px)
      `,
      backgroundSize: "32px 32px"
    }}
  />
  
  {/* Header */}
  <div className="relative px-6 py-4 border-b border-border/20">
    ...
  </div>
  
  {/* Content */}
  <div className="relative p-6">
    ...
  </div>
</div>
```

---

#### 2. Globo Visível Atrás do Domínio

**Problema:** O card do domínio tem `bg-card/80` que esconde o globo.

**Solução:** Usar fundo transparente com apenas blur e borda:

```tsx
// Antes
<div className="relative px-8 py-4 rounded-xl border-2 border-primary/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/10">

// Depois
<div className="relative px-8 py-4 rounded-xl border-2 border-primary/50 bg-transparent backdrop-blur-[2px] shadow-lg shadow-primary/10">
```

---

#### 3. IPs dos Registros NS

**Problema:** Os IPs dos NS não estão disponíveis no `dnsSummary.ns[]` (só contém nomes).

**Solução:** Os dados de NS tipicamente não incluem IPs resolvidos no backend atual. Por ora, manter só o hostname. 

*Nota para futuro:* Adicionar campo `ns_resolved` ou similar na edge function de análise.

---

#### 4. Filtro Padrão "Ativos"

**Solução:** Alterar o estado inicial:

```tsx
// Antes
const [subdomainFilter, setSubdomainFilter] = useState<SubdomainFilter>('all');

// Depois
const [subdomainFilter, setSubdomainFilter] = useState<SubdomainFilter>('active');
```

---

#### 5. Aumentar Tamanho das Fontes

Atualizar os tamanhos de `text-[10px]` para `text-xs` (12px) nas informações secundárias:

| Elemento | Antes | Depois |
|----------|-------|--------|
| SPF record | `text-[10px]` | `text-xs` |
| DKIM selectors | `text-[10px]` | `text-xs` |
| DMARC policies | `text-[10px]` | `text-xs` |
| Subdomain IPs | `text-[10px]` | `text-xs` |
| SOA labels | `text-xs` | `text-sm` (para labels) |
| Filter buttons | `text-[10px]` | `text-xs` |

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

---

### Resultado Visual Esperado

- Fundo do mapa DNS consistente com o card de informações (gradient escuro + grid)
- Globo visível atrás do nome do domínio (sem card opaco)
- Filtro "ativos" selecionado por padrão
- Textos secundários mais legíveis (fonte maior)

