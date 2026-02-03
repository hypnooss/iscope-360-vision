
## Melhorias no Mapa DNS - Layout de 3 Colunas

### Objetivo

Reorganizar o mapa DNS para layout de 3 colunas (empilhadas) conforme o esboço, e enriquecer os cards com mais informações técnicas.

### Layout Proposto

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         taschibra.com.br                                  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  COLUNA 1      │     │  COLUNA 2      │     │  COLUNA 3      │
│                │     │                │     │                │
│  ┌──────────┐  │     │  ┌──────────┐  │     │  ┌──────────┐  │
│  │    NS    │  │     │  │   SOA    │  │     │  │ Subdomín.│  │
│  └──────────┘  │     │  └──────────┘  │     │  └──────────┘  │
│  ns1-06...    │     │  Primary:      │     │  10 ativos     │
│  40.112.72... │     │  ns1-06...     │     │  7 inativos    │
│  ns2-06...    │     │  Contact:      │     │                │
│  40.112.72... │     │  azuredns-...  │     │  ● www         │
│  ...          │     │  DNSSEC: ○     │     │    187.85...   │
│               │     │                │     │  ● drive       │
│  ┌──────────┐  │     │  ┌──────────┐  │     │    187.85...   │
│  │    MX    │  │     │  │   TXT    │  │     │  ○ chat        │
│  └──────────┘  │     │  └──────────┘  │     │  ○ mail        │
│  outlook.mail  │     │  ● SPF        │     │  ...           │
│  Prio: 0 •    │     │    v=spf1 ... │     │                │
│  2a01:111:... │     │  ● DKIM       │     │                │
│               │     │    selector1   │     │                │
│               │     │    selector2   │     │                │
│               │     │  ● DMARC      │     │                │
│               │     │    p: reject   │     │                │
│               │     │    sp: reject  │     │                │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

### Alterações Detalhadas

#### 1. Layout em 3 Colunas

**Antes:** Grid de 5 colunas (`lg:grid-cols-5`)

**Depois:** Grid de 3 colunas com empilhamento vertical:
- **Coluna 1:** NS + MX (empilhados)
- **Coluna 2:** SOA + TXT (empilhados)
- **Coluna 3:** Subdomínios (coluna inteira, com scroll)

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Coluna 1: NS + MX */}
  <div className="space-y-4">
    <DNSGroup title="NS" ... />
    <DNSGroup title="MX" ... />
  </div>
  
  {/* Coluna 2: SOA + TXT */}
  <div className="space-y-4">
    <DNSGroup title="SOA" ... />
    <DNSGroup title="TXT" ... />
  </div>
  
  {/* Coluna 3: Subdomínios */}
  <DNSGroup title="Subdomínios" ... />
</div>
```

---

#### 2. NS Records - Adicionar IPs Resolvidos

Atualmente só mostra o hostname. Adicionar sublabel com IP resolvido via DNS-over-HTTPS.

**Problema:** Os IPs dos NS não estão disponíveis no `dnsSummary.ns[]` (só nomes).

**Solução:** Para esta iteração, **não resolver dinamicamente** (evitar delay). Exibir apenas o hostname, já que NS geralmente são serviços externos (Azure DNS, Cloudflare, etc).

*Alternativa futura:* Adicionar campo `ns_ips` ao `dnsSummary` na edge function.

---

#### 3. Grupo TXT - SPF com Registro Completo

**Antes:**
```
● SPF    ✓ Válido
```

**Depois:**
```
● SPF
  v=spf1 include:spf.protection.outlook.com -all
```

Extração do dado:
```tsx
const extractSpfRecord = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  const spfCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'spf_record');
  return (spfCheck?.rawData as any)?.data?.raw || null;
};
```

---

#### 4. Grupo TXT - DKIM com Seletores

**Antes:**
```
● DKIM   ✓ Válido
```

**Depois:**
```
● DKIM
  selector1
  selector2
```

Extração do dado:
```tsx
const extractDkimSelectors = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  const dkimCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'dkim_records');
  const found = (dkimCheck?.rawData as any)?.data?.found || [];
  return found.map((f: any) => f.selector).filter(Boolean);
};
```

---

#### 5. Grupo TXT - DMARC com Políticas

**Antes:**
```
● DMARC  ✓ Válido
```

**Depois:**
```
● DMARC
  Política: reject
  Política Subdomínios: reject
```

Extração do dado:
```tsx
const extractDmarcPolicy = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  const dmarcCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'dmarc_record');
  const parsed = (dmarcCheck?.rawData as any)?.data?.parsed || {};
  return {
    p: parsed.p || null,   // política principal
    sp: parsed.sp || null, // política de subdomínios
  };
};
```

---

#### 6. Conector Visual (SVG)

Atualizar as linhas de conexão para refletir 3 colunas em vez de 5:

```tsx
{/* Horizontal connector bar */}
<div className="relative h-4 mx-8 mb-2">
  <div className="absolute inset-x-0 top-0 h-px bg-border" />
  {/* 3 drops: 25%, 50%, 75% */}
  <div className="absolute left-1/4 top-0 w-px h-4 bg-border" />
  <div className="absolute left-1/2 top-0 w-px h-4 bg-border -translate-x-1/2" />
  <div className="absolute left-3/4 top-0 w-px h-4 bg-border" />
</div>
```

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

---

### Componente TXT Atualizado (Exemplo)

```tsx
{/* TXT (Email Auth) - Detalhado */}
<DNSGroup
  title="TXT"
  count={3}
  icon={<FileText className="w-4 h-4 text-emerald-400" />}
  color="border-emerald-500/30 bg-emerald-500/5"
>
  <div className="space-y-3 px-1">
    {/* SPF */}
    <div className="text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", emailAuth.spf ? "bg-primary" : "bg-rose-400")} />
        <span className="font-medium text-foreground">SPF</span>
      </div>
      {spfRecord && (
        <span className="text-[10px] text-muted-foreground font-mono block pl-4 truncate">
          {spfRecord}
        </span>
      )}
    </div>
    
    {/* DKIM */}
    <div className="text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", emailAuth.dkim ? "bg-primary" : "bg-rose-400")} />
        <span className="font-medium text-foreground">DKIM</span>
      </div>
      {dkimSelectors.map((sel, i) => (
        <span key={i} className="text-[10px] text-muted-foreground font-mono block pl-4">
          {sel}
        </span>
      ))}
    </div>
    
    {/* DMARC */}
    <div className="text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", emailAuth.dmarc ? "bg-primary" : "bg-rose-400")} />
        <span className="font-medium text-foreground">DMARC</span>
      </div>
      {dmarcPolicy.p && (
        <span className="text-[10px] text-muted-foreground font-mono block pl-4">
          Política: {dmarcPolicy.p}
        </span>
      )}
      {dmarcPolicy.sp && (
        <span className="text-[10px] text-muted-foreground font-mono block pl-4">
          Política Subdomínios: {dmarcPolicy.sp}
        </span>
      )}
    </div>
  </div>
</DNSGroup>
```

---

### Resultado Visual Esperado

| Antes | Depois |
|-------|--------|
| 5 colunas estreitas | 3 colunas largas empilhadas |
| SPF: ✓ Válido | SPF + registro `v=spf1...` |
| DKIM: ✓ Válido | DKIM + seletores (selector1, selector2) |
| DMARC: ✓ Válido | DMARC + p:reject, sp:reject |
| NS sem IPs | NS (IPs futuramente) |
