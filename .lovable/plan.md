

## Melhorias Visuais e IPs dos Nameservers

### Problemas Identificados

1. **Globo com borda opaca** - O nome do domínio tem fundo opaco que esconde o globo
2. **Espaçamento insuficiente** entre as categorias (NS/MX e SOA/TXT)
3. **Estilo inconsistente** dos itens - Precisam do padrão "fundo mais escuro, borda cinza"
4. **Fontes pequenas** nas informações secundárias
5. **IPs dos NS não aparecem** - Os dados existem no `rawData` mas não estão sendo extraídos

### Por que os IPs dos NS não aparecem?

O backend salva os IPs resolvidos dentro de cada registro NS:
```json
{
  "step_id": "ns_records",
  "data": {
    "records": [
      { "host": "ns1-06.azure-dns.com", "resolved_ips": ["40.112.72.205"] },
      { "host": "ns2-06.azure-dns.net", "resolved_ips": ["64.4.48.205"] }
    ]
  }
}
```

Porém, o `dnsSummary` passado para o `DNSMapSection` contém apenas uma lista de strings (hostnames):
```typescript
dnsSummary.ns = ["ns1-06.azure-dns.com", "ns2-06.azure-dns.net"]
```

**Solucao**: Criar uma funcao `extractNsRecords()` que extrai os dados completos (hostname + IPs) diretamente do `rawData` das categorias, igual ja fazemos para MX, SPF, DKIM e DMARC.

---

### Alteracoes Tecnicas

#### 1. Nova Interface e Funcao de Extracao para NS

```typescript
interface NsRecord {
  host: string;
  resolvedIps: string[];
}

const extractNsRecords = (categories: ComplianceCategory[]): NsRecord[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const nsCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'ns_records');
  const records = (nsCheck?.rawData as any)?.data?.records || [];
  
  return records.map((r: any) => ({
    host: r.host || r.name || r.value || 'Unknown',
    resolvedIps: Array.isArray(r.resolved_ips) ? r.resolved_ips : [],
  })).filter((ns: NsRecord) => ns.host && ns.host !== 'Unknown');
};
```

#### 2. Atualizar Estilo do No do Dominio

Remover o fundo opaco, manter apenas blur e borda para o globo ficar visivel:

```typescript
// Card do dominio - transparente
<div className="relative px-8 py-4 rounded-xl border border-primary/30">
  <span className="text-lg font-bold text-foreground tracking-wide">{domain}</span>
</div>
```

#### 3. Aumentar Espacamento entre Categorias

Alterar o `space-y-4` para `space-y-6` nas colunas 1 e 2:

```typescript
{/* Column 1: NS + MX */}
<div className="space-y-6">
  <DNSGroup title="NS" ... />
  <DNSGroup title="MX" ... />
</div>
```

#### 4. Padronizar Estilo dos Itens (DNSNode)

Aplicar o padrao visual da print de referencia - fundo mais escuro com borda sutil:

```typescript
<div className={cn(
  "group relative px-3 py-2.5 rounded-lg border transition-all",
  "bg-[hsl(220_18%_8%)] border-border/40 hover:border-border/60"
)}>
```

#### 5. Aumentar Tamanho das Fontes Secundarias

| Elemento | Antes | Depois |
|----------|-------|--------|
| Label principal | `text-sm` | `text-sm` (manter) |
| Sublabel/IP | `text-xs` | `text-[13px]` |
| SOA labels | `text-xs` | `text-sm` |
| TXT records | `text-xs` | `text-[13px]` |

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

---

### Resultado Visual Esperado

**Antes (NS):**
```
ns1-06.azure-dns.com
ns2-06.azure-dns.net
```

**Depois (NS com IPs):**
```
● ns1-06.azure-dns.com
  40.112.72.205

● ns2-06.azure-dns.net  
  64.4.48.205
```

**Padrao Visual dos Cards:**
- Fundo: `hsl(220 18% 8%)` (escuro, consistente com o mapa)
- Borda: `border-border/40` (cinza sutil)
- Fonte principal: `text-sm font-mono`
- Fonte secundaria: `text-[13px] text-muted-foreground`

