
# Plano: Correções nas Evidências MX, DKIM e DMARC

## Problemas Identificados

### 1. Redundância MX - IPs não exibidos
O contexto `mx_redundancy` não está definido em `CONTEXT_HIDDEN_FIELDS`, mas deveria manter resolved_ips visível. O código na linha 285 define `context = 'mx_redundancy'`, mas não há entrada correspondente - então todos os campos são exibidos. O problema real é que os campos `resolved_ips` e `resolved_ip_count` estão sendo processados mas podem estar em formato JSON.

### 2. DKIM Configurado e Redundância DKIM - JSON muito longo
O tratamento DKIM atual usa `RecordDisplay` que mostra TODOS os campos não ocultos. Campos como `txt_raw`, `name`, `flags`, etc. estão sendo exibidos. Para simplificar:
- **DKIM Configurado**: Mostrar apenas que chaves foram encontradas (quantidade)
- **Redundância DKIM**: Mostrar apenas os nomes das chaves DKIM

### 3. Alinhamentos DMARC (aspf, adkim, rua) - Sem evidências
Os labels `data.parsed.aspf`, `data.parsed.adkim` e `data.parsed.rua` estão mapeados em `LABEL_TRANSLATIONS` e `VALUE_TRANSFORMATIONS`, mas as evidências não estão aparecendo. Isso sugere que os valores estão chegando como texto simples e as transformações estão sendo aplicadas, mas o label traduzido precisa ser passado corretamente.

---

## Alterações no `src/components/compliance/EvidenceDisplay.tsx`

### 1. Corrigir tratamento de Redundância MX

Adicionar formatação específica para `resolved_ips` quando é um array JSON:

```typescript
// Em FIELD_LABELS, garantir que existe:
resolved_ips: 'IPs Resolvidos',
resolved_ip_count: 'Quantidade de IPs',

// Em RecordDisplay, formatar arrays de IPs
{typeof value === 'object' && Array.isArray(value) 
  ? value.join(', ') 
  : typeof value === 'object' 
    ? JSON.stringify(value) 
    : String(value)}
```

### 2. Simplificar exibição DKIM

Criar tratamento específico para DKIM que detecta o contexto do card:

```typescript
// Para DKIM Configurado: mostrar contagem de chaves
// Para Redundância DKIM: mostrar nomes das chaves

const isDkimRecord = item.label.includes('DKIM') || 
  item.label === 'data.found' || 
  item.label === 'data.found[]' ||
  (Array.isArray(parsed) && parsed[0]?.selector !== undefined);

if (isDkimRecord && Array.isArray(parsed)) {
  // Determinar contexto pelo label
  const isRedundancyCheck = item.label.toLowerCase().includes('redundância') ||
                            item.label.toLowerCase().includes('redundancy');
  
  if (isRedundancyCheck) {
    // Redundância DKIM: mostrar nomes das chaves
    return (
      <div className="...">
        {parsed.map((record, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-xs...">Chave DKIM</span>
            <span className="text-sm...">{record.name || record.selector}</span>
          </div>
        ))}
      </div>
    );
  } else {
    // DKIM Configurado: mostrar que chaves foram encontradas
    return (
      <div className="...">
        <span className="text-xs...">Chaves DKIM Encontradas</span>
        <span className="text-sm...">{parsed.length} chave(s) configurada(s)</span>
      </div>
    );
  }
}
```

### 3. Adicionar campos DKIM a HIDDEN_FIELDS

Garantir que campos muito técnicos do DKIM não apareçam:

```typescript
const HIDDEN_FIELDS = ['p_length', 'p', 'txt_raw', 'flags'];
```

### 4. Corrigir exibição do contexto MX

Para Redundância MX, não aplicar contexto (ou criar um contexto explícito que não oculte nada):

```typescript
// No tratamento MX
if (isMxRecord && Array.isArray(parsed)) {
  const isRedundancyCheck = item.label.toLowerCase().includes('redundância');
  
  // Para redundância, NÃO ocultar campos técnicos
  // Para outros cards MX, ocultar priority, resolved_ips, resolved_ip_count
  const context = isRedundancyCheck ? undefined : 'mx_simple';
  
  return (
    <div className="...">
      {parsed.map((record, idx) => (
        <RecordDisplay 
          key={idx} 
          record={record as Record<string, unknown>}
          context={context}
          labelOverrides={{ exchange: 'Servidor MX' }}
        />
      ))}
    </div>
  );
}
```

### 5. Corrigir formatação de arrays em RecordDisplay

Modificar `RecordDisplay` para formatar arrays de forma legível:

```typescript
function RecordDisplay({ record, context, labelOverrides }: RecordDisplayProps) {
  // ...existing code...

  return (
    <div className="...">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <span className="...">{getLabel(key)}</span>
          <span className="...">
            {Array.isArray(value) 
              ? value.join(', ')
              : typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Resultado Visual Esperado

### Redundância MX (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Servidor MX
estrela-com-br.mail.protection.outlook.com

Prioridade
10

IPs Resolvidos
192.168.1.1, 192.168.1.2

Quantidade de IPs
2
```

### DKIM Configurado (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Chaves DKIM Encontradas
2 chave(s) configurada(s)
```

### Redundância DKIM (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Chave DKIM
selector1._domainkey.precisio.io

Chave DKIM
selector2._domainkey.precisio.io
```

### Alinhamento SPF Estrito (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Alinhamento SPF
Relaxado (r)
```

### Alinhamento DKIM Estrito (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Alinhamento DKIM
Estrito (s) ✓
```

### Relatórios DMARC (RUA) (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Relatórios (RUA)
mailto:db93c273a8@rua.easydmarc.com
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Simplificar DKIM, corrigir MX redundância, formatar arrays |

---

## Considerações Técnicas

1. **Contexto por label**: Usamos o label do item para determinar qual tratamento aplicar
2. **Fallback**: Se parsing falhar, mostra valor original
3. **Arrays**: IPs e outros arrays são formatados com vírgulas para legibilidade
4. **DKIM simplificado**: Não expor dados técnicos como chave pública ou flags
