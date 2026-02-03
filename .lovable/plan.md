

## Correção do Fluxo de Dados de Subdomínios

### Problema Identificado

O agente Python agora envia os dados de subdomínios com o novo formato:

```json
{
  "subdomain": "www.taschibra.com.br",
  "sources": ["crt.sh"],
  "ips": ["192.168.1.10"],
  "is_alive": true
}
```

Porém, a edge function `agent-task-result` espera o formato antigo com `addresses`:

```json
{
  "subdomain": "www.taschibra.com.br",
  "sources": ["crt.sh"],
  "addresses": [{ "ip": "192.168.1.10", "type": "A" }]
}
```

Como resultado, os IPs não são mapeados corretamente e a interface exibe `—` na coluna de endereços IP.

### Solução

Atualizar 3 arquivos para suportar o novo formato e exibir o status de atividade:

---

### 1. Edge Function: `agent-task-result/index.ts`

**Localização:** Linhas 3549-3565 (normalização de subdomínios)

**Alteração:** Converter o novo formato `ips` para `addresses` e preservar `is_alive`:

```typescript
// Normalize subdomain entries
const normalizedSubdomains: SubdomainEntry[] = subdomains
  .filter((s: unknown) => s && typeof s === 'object')
  .map((s: unknown) => {
    const sub = s as Record<string, unknown>;
    
    // Support new format: "ips" array of strings
    let addresses: Array<{ ip: string; type?: string }> = [];
    if (Array.isArray(sub.ips)) {
      addresses = (sub.ips as string[])
        .filter((ip) => typeof ip === 'string' && ip.length > 0)
        .map((ip) => ({ ip, type: ip.includes(':') ? 'AAAA' : 'A' }));
    } else if (Array.isArray(sub.addresses)) {
      addresses = (sub.addresses as Array<Record<string, unknown>>).map((addr) => ({
        ip: typeof addr.ip === 'string' ? addr.ip : (typeof addr.address === 'string' ? addr.address : ''),
        type: typeof addr.type === 'string' ? addr.type : undefined,
      }));
    }
    
    return {
      subdomain: typeof sub.subdomain === 'string' ? sub.subdomain : (typeof sub.name === 'string' ? sub.name : ''),
      sources: Array.isArray(sub.sources) ? sub.sources.filter((src: unknown) => typeof src === 'string') : [],
      addresses,
      is_alive: typeof sub.is_alive === 'boolean' ? sub.is_alive : undefined,
    };
  })
  .filter((s: SubdomainEntry) => s.subdomain.length > 0);
```

**Atualizar interface SubdomainEntry (linhas 90-94):**

```typescript
interface SubdomainEntry {
  subdomain: string;
  sources: string[];
  addresses: Array<{ ip: string; type?: string }>;
  is_alive?: boolean;
}
```

---

### 2. Tipos do Frontend: `src/types/compliance.ts`

**Alteração:** Adicionar campo `is_alive` ao tipo `SubdomainEntry`:

```typescript
export interface SubdomainEntry {
  subdomain: string;
  sources: string[];
  addresses: Array<{ ip: string; type?: string }>;
  is_alive?: boolean;
}
```

---

### 3. Componente de UI: `src/components/external-domain/SubdomainSection.tsx`

**Alterações:**

1. **Adicionar badge de status (ativo/inativo)** na coluna de subdomínio
2. **Adicionar contagem de ativos/inativos** no header
3. **Melhorar visual** para destacar subdomínios inativos

```tsx
// No header, após o badge de total:
{summary.subdomains.some(s => s.is_alive !== undefined) && (
  <>
    <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary border-primary/20">
      {summary.subdomains.filter(s => s.is_alive).length} ativos
    </Badge>
    <Badge variant="secondary" className="ml-1 bg-muted text-muted-foreground border-muted-foreground/20">
      {summary.subdomains.filter(s => s.is_alive === false).length} inativos
    </Badge>
  </>
)}

// Na célula do subdomínio, adicionar indicador visual:
<TableCell className="font-mono text-sm">
  <div className="flex items-center gap-2">
    {sub.is_alive !== undefined && (
      <span 
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          sub.is_alive 
            ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" 
            : "bg-muted-foreground/30"
        )}
        title={sub.is_alive ? "Ativo" : "Inativo"}
      />
    )}
    <span className={cn(
      "text-foreground break-all",
      sub.is_alive === false && "text-muted-foreground"
    )}>
      {sub.subdomain}
    </span>
    // ... botões de ação
  </div>
</TableCell>

// Na célula de IPs, mostrar "Não resolvido" para inativos:
<TableCell className="text-sm text-muted-foreground">
  {sub.addresses.length > 0 ? (
    // ... exibir badges de IP
  ) : (
    <span className="text-muted-foreground/50">
      {sub.is_alive === false ? 'Não resolvido' : '—'}
    </span>
  )}
</TableCell>
```

---

### Fluxo de Dados Corrigido

```text
┌─────────────────────┐
│   Python Agent      │
│ ips: ["1.2.3.4"]    │
│ is_alive: true      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  agent-task-result  │
│  Edge Function      │
│  Converte ips →     │
│  addresses          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    Supabase DB      │
│  addresses: [...]   │
│  is_alive: true     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   SubdomainSection  │
│   Exibe IPs e       │
│   status visual     │
└─────────────────────┘
```

---

### Resultado Esperado

| Antes | Depois |
|-------|--------|
| Todos subdomínios sem IP | IPs resolvidos exibidos |
| Sem indicação de status | Badge verde (ativo) ou cinza (inativo) |
| Lista plana | Contagem de ativos/inativos no header |

---

### Deploy

1. Atualizar edge function `agent-task-result`
2. Atualizar tipos TypeScript
3. Atualizar componente SubdomainSection
4. Disparar nova análise para popular dados no novo formato

