
# Plano: Corrigir Exibição de Evidências

## Problema Identificado

A abordagem anterior tinha 2 falhas:

1. **`data.records` foi ESCONDIDO** - Isso removeu completamente as evidências de Nameservers em vez de processá-las
2. **Fallback genérico do backend** - Quando não há formatador específico, o backend envia labels técnicos como `data.refresh`, `data.serial`, `data.records`

## Solução

Em vez de esconder labels, precisamos **processar o conteúdo JSON** deles e exibir de forma formatada.

---

## Alterações em `src/components/compliance/EvidenceDisplay.tsx`

### 1. Remover `data.records` do HIDDEN_LABELS

O label não deve ser oculto - o conteúdo JSON deve ser parseado e exibido.

```typescript
// Labels que devem ser completamente ocultos (não aparecem na UI)
const HIDDEN_LABELS: string[] = [];  // Vazio - não esconder nada por padrão
```

### 2. Adicionar mais traduções de labels

```typescript
const LABEL_TRANSLATIONS: Record<string, string> = {
  // ... existentes ...
  'data.records': 'Nameservers',
  'data.refresh': 'Tempo de Refresh',
  'data.serial': 'Número Serial',
  'data.expire': 'Tempo de Expiração',
  'data.minimum': 'TTL Mínimo',
  'data.retry': 'Tempo de Retry',
  'data.ttl': 'TTL',
  'data.mname': 'Nameserver Primário',
  'data.rname': 'Email do Responsável',
};
```

### 3. Adicionar formatação de valores numéricos para SOA

```typescript
const VALUE_TRANSFORMATIONS: Record<string, Record<string, string>> = {
  // ... existentes ...
  // Para valores numéricos do SOA, adicionar unidade
};

// OU criar função de formatação especial
function formatSOAValue(label: string, value: string): string {
  // Para campos de tempo do SOA, converter segundos para formato legível
  if (['data.refresh', 'data.retry', 'data.expire', 'data.minimum', 'data.ttl'].includes(label)) {
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds)) {
      if (seconds >= 86400) {
        return `${Math.floor(seconds / 86400)} dia(s) (${seconds}s)`;
      } else if (seconds >= 3600) {
        return `${Math.floor(seconds / 3600)} hora(s) (${seconds}s)`;
      } else if (seconds >= 60) {
        return `${Math.floor(seconds / 60)} minuto(s) (${seconds}s)`;
      }
      return `${seconds} segundos`;
    }
  }
  return value;
}
```

### 4. Melhorar parsing de JSON em `data.records`

Quando o label é `data.records` e o valor é um JSON de nameservers, parsear e exibir cada host individualmente:

```typescript
function FormattedCodeEvidence({ item }: FormattedCodeEvidenceProps) {
  // ... código existente ...

  // NOVO: Tratamento especial para data.records (nameservers)
  if (item.label === 'data.records' || item.label === 'Nameservers') {
    // Se for array de objetos com 'host' ou 'name'
    if (Array.isArray(parsed)) {
      const hosts = parsed
        .map(r => {
          if (typeof r === 'string') return r;
          if (r && typeof r === 'object') {
            return (r as Record<string, unknown>).host || 
                   (r as Record<string, unknown>).name ||
                   (r as Record<string, unknown>).value;
          }
          return null;
        })
        .filter(Boolean);
      
      if (hosts.length > 0) {
        return (
          <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-2">
            {hosts.map((host, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">Nameserver</span>
                <span className="text-sm text-foreground font-mono">{String(host)}</span>
              </div>
            ))}
          </div>
        );
      }
    }
  }
  
  // ... resto do código existente ...
}
```

---

## Resultado Visual Esperado

### Diversidade de Nameservers (CORRIGIDO)

**Antes:**
```
EVIDÊNCIAS COLETADAS
(vazio - data.records estava escondido)
```

**Depois:**
```
EVIDÊNCIAS COLETADAS
Nameserver
ns77.domaincontrol.com

Nameserver
ns78.domaincontrol.com
```

### SOA Refresh Adequado (CORRIGIDO)

**Antes:**
```
data.refresh
86400
```

**Depois:**
```
Tempo de Refresh
1 dia(s) (86400s)
```

### SOA Serial Atualizado (CORRIGIDO)

**Antes:**
```
data.serial
2026001000
```

**Depois:**
```
Número Serial
2026001000
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Remover HIDDEN_LABELS, adicionar mais traduções, melhorar parsing de JSON |

---

## Considerações

1. **Extensível**: Fácil adicionar mais traduções conforme novos checks aparecem
2. **Fallback seguro**: Se parsing falhar, mostra o valor original
3. **Formatação de tempo**: Valores de segundos são convertidos para formato legível (dias, horas, minutos)
4. **Sem quebra**: Labels não traduzidos continuam funcionando com o nome original

