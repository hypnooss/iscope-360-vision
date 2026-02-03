

## Melhorias no Mapa DNS - Visual e Funcionalidades

### Resumo das Alterações

1. **Remover campo de busca** do topo do mapa
2. **Melhorar exibição do domínio** com globo de fundo
3. **Redesenhar linhas de conexão** conforme referência (linhas verticais saindo para baixo e depois conectando às colunas)
4. **DKIM com tamanho da chave** (dados disponíveis: `key_size_bits`)
5. **Filtros de subdomínios** (ativos/inativos como botões seletores)
6. **Remover scrollbars** - altura variável baseada no conteúdo

---

### Alterações Detalhadas

#### 1. Remover Campo de Busca

Remover o bloco de Input com ícone Search (linhas 303-314).

---

#### 2. Domínio com Globo de Fundo

Redesenhar o nó raiz com um globo estilizado ao fundo:

```tsx
{/* Root Domain Node - with globe background */}
<div className="flex justify-center mb-4">
  <div className="relative">
    {/* Globe background */}
    <div className="absolute inset-0 flex items-center justify-center">
      <Globe className="w-24 h-24 text-primary/10" />
    </div>
    {/* Domain name overlay */}
    <div className="relative px-8 py-4 rounded-xl border-2 border-primary/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/10">
      <span className="text-lg font-bold text-foreground tracking-wide">{domain}</span>
    </div>
  </div>
</div>
```

---

#### 3. Redesenhar Linhas de Conexão

Conforme a referência, as linhas devem:
- Sair do centro do domínio para baixo (vertical)
- Fazer curva em "L" invertido para cada coluna
- Terminar no topo de cada grupo (NS/MX, SOA/TXT, Subdomínios)

Nova estrutura SVG:

```tsx
{/* Connector Lines - L-shaped drops */}
<div className="relative h-12 mx-8 mb-2 hidden md:block">
  {/* Vertical line from domain center */}
  <div className="absolute left-1/2 top-0 w-px h-6 bg-border -translate-x-1/2" />
  
  {/* Horizontal connector bar */}
  <div className="absolute left-[16.67%] right-[16.67%] top-6 h-px bg-border" />
  
  {/* Vertical drops to each column */}
  <div className="absolute left-[16.67%] top-6 w-px h-6 bg-border" />
  <div className="absolute left-1/2 top-6 w-px h-6 bg-border -translate-x-1/2" />
  <div className="absolute left-[83.33%] top-6 w-px h-6 bg-border" />
  
  {/* Corner pieces (optional rounded corners) */}
  <div className="absolute left-[16.67%] top-[23px] w-2 h-2 border-l border-t border-border rounded-tl" />
  <div className="absolute left-[83.33%] top-[23px] w-2 h-2 border-r border-t border-border rounded-tr -translate-x-full" />
</div>
```

---

#### 4. DKIM com Tamanho da Chave

Atualizar a função `extractDkimSelectors` para retornar seletor + tamanho:

**Antes:**
```tsx
const extractDkimSelectors = (categories: ComplianceCategory[]): string[] => {
  // Retorna apenas seletores: ['selector1', 'selector2']
};
```

**Depois:**
```tsx
interface DkimKey {
  selector: string;
  keySize: number | null;
}

const extractDkimKeys = (categories: ComplianceCategory[]): DkimKey[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const dkimCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'dkim_records');
  const found = (dkimCheck?.rawData as any)?.data?.found || [];
  return found.map((f: any) => ({
    selector: f.selector,
    keySize: f.key_size_bits || null,
  })).filter((k: DkimKey) => k.selector);
};
```

**Exibição:**
```tsx
{dkimKeys.map((key, i) => (
  <span key={i} className="text-[10px] text-muted-foreground font-mono block pl-4">
    {key.selector}{key.keySize ? ` - ${key.keySize} bits` : ''}
  </span>
))}
```

---

#### 5. Filtros de Subdomínios (Toggle Buttons)

Transformar os badges "X ativos" e "Y inativos" em botões de filtro:

```tsx
type SubdomainFilter = 'all' | 'active' | 'inactive';
const [subdomainFilter, setSubdomainFilter] = useState<SubdomainFilter>('all');

// Filter logic
const filteredSubdomains = useMemo(() => {
  if (!subdomainSummary?.subdomains) return [];
  
  switch (subdomainFilter) {
    case 'active':
      return subdomainSummary.subdomains.filter(s => s.is_alive);
    case 'inactive':
      return subdomainSummary.subdomains.filter(s => s.is_alive === false);
    default:
      return subdomainSummary.subdomains;
  }
}, [subdomainSummary?.subdomains, subdomainFilter]);

// Toggle buttons UI
<div className="flex gap-1 mb-2 px-1">
  <button
    onClick={() => setSubdomainFilter(f => f === 'active' ? 'all' : 'active')}
    className={cn(
      "text-[10px] px-2 py-1 rounded-md border transition-all",
      subdomainFilter === 'active' 
        ? "bg-primary/20 text-primary border-primary/40" 
        : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
    )}
  >
    {activeCount} ativos
  </button>
  <button
    onClick={() => setSubdomainFilter(f => f === 'inactive' ? 'all' : 'inactive')}
    className={cn(
      "text-[10px] px-2 py-1 rounded-md border transition-all",
      subdomainFilter === 'inactive' 
        ? "bg-muted text-muted-foreground border-muted-foreground/40" 
        : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
    )}
  >
    {inactiveCount} inativos
  </button>
</div>
```

---

#### 6. Remover Scrollbars - Altura Variável

**Mudanças no `DNSGroup`:**

- Remover prop `maxHeight`
- Remover `overflow-y-auto` e `scrollbar-thin`
- Permitir que o conteúdo cresça naturalmente

**Antes:**
```tsx
<div 
  className="space-y-1 overflow-y-auto scrollbar-thin"
  style={{ maxHeight }}
>
```

**Depois:**
```tsx
<div className="space-y-1">
```

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

---

### Resultado Visual Esperado

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  🌐 Mapa de Infraestrutura DNS                                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                          ┌─────🌍─────┐                                  │
│                          │   taschibra│                                  │
│                          │   .com.br  │                                  │
│                          └─────┬──────┘                                  │
│                                │                                         │
│               ┌────────────────┼────────────────┐                        │
│               │                │                │                        │
│               ▼                ▼                ▼                        │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│     │      NS      │  │     SOA      │  │  Subdomínios │                │
│     └──────────────┘  └──────────────┘  └──────────────┘                │
│     ns1-06...        Primary:           [3 ativos] [7 inativos]         │
│     ns2-06...        ns1-06...          ● chat.taschibra...             │
│     ns3-06...        Contact:           ● drive.taschibra...            │
│     ns4-06...        azuredns-host...     187.85.164.49                 │
│                      DNSSEC: ○          ● ida-fw.taschibra...           │
│     ┌──────────────┐                      177.200.196.230               │
│     │      MX      │  ┌──────────────┐  ○ mail.taschibra...             │
│     └──────────────┘  │     TXT      │  ○ mx2.taschibra...              │
│     taschibra-com...  └──────────────┘  ○ ns1.taschibra...              │
│     Prio: 0 •         ● SPF             ○ ns2.taschibra...              │
│     2a01:111:f403..     v=spf1 include  ○ ns3.taschibra...              │
│                       ● DKIM            ○ vpn.taschibra...              │
│                         selector1 - 2352 bits                           │
│                         selector2 - 2352 bits                           │
│                       ● DMARC                                           │
│                         Política: reject                                │
│                         Política Subdomínios: reject                    │
│                                                                          │
│  Fontes: crt.sh, hackertarget, alienvault, rapiddns, certspotter        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Ordem de Implementação

1. Remover Input de busca
2. Redesenhar nó do domínio com globo
3. Atualizar estrutura de conectores SVG
4. Modificar `extractDkimSelectors` → `extractDkimKeys` com tamanho
5. Implementar filtros de subdomínios (toggle buttons)
6. Remover `maxHeight` e scrollbars do `DNSGroup`
7. Testar altura variável em relatórios com muitos subdomínios

