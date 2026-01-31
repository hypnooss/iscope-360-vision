
# Plano: Traduções e Ajustes por Tipo de Card MX/SPF

## Resumo das Alterações

Precisamos criar lógica específica por tipo de check para controlar quais campos são exibidos e suas traduções.

---

## Alterações em `src/components/compliance/EvidenceDisplay.tsx`

### 1. Adicionar traduções de labels técnicos

```typescript
const LABEL_TRANSLATIONS: Record<string, string> = {
  // ... existentes ...
  'data.records[0].exchange': 'Servidor MX',
  'data.parsed.includes': 'DNS Lookups (includes)',
  'data.parsed.all': 'Política SPF (all)',
  'data.raw': 'Registro SPF',
};
```

### 2. Adicionar traduções para campos dentro de records MX

```typescript
const FIELD_LABELS: Record<string, string> = {
  // ... existentes ...
  resolved_ips: 'IPs Resolvidos',
  resolved_ip_count: 'Quantidade de IPs',
};
```

### 3. Criar lista de campos ocultos POR TIPO DE LABEL

Para os cards "Prioridades MX Configuradas" e "Registro MX Configurado", precisamos ocultar campos específicos:

```typescript
// Campos a ocultar por contexto de label
const CONTEXT_HIDDEN_FIELDS: Record<string, string[]> = {
  // Para cards de MX simples (não redundância), ocultar estes campos
  'mx_priorities': ['priority', 'resolved_ips', 'resolved_ip_count'],
  'mx_record': ['priority', 'resolved_ips', 'resolved_ip_count'],
};
```

### 4. Modificar RecordDisplay para aceitar contexto

Atualizar o componente `RecordDisplay` para receber um parâmetro opcional de contexto que determina quais campos ocultar:

```typescript
interface RecordDisplayProps {
  record: Record<string, unknown>;
  context?: string;  // Contexto para ocultar campos específicos
  labelOverrides?: Record<string, string>;  // Sobrescrever labels para este contexto
}

function RecordDisplay({ record, context, labelOverrides }: RecordDisplayProps) {
  // Campos ocultos para este contexto específico
  const contextHiddenFields = context ? (CONTEXT_HIDDEN_FIELDS[context] || []) : [];
  
  const entries = Object.entries(record)
    .filter(([key, value]) => 
      value !== null && 
      value !== undefined && 
      value !== '' &&
      !HIDDEN_FIELDS.includes(key) &&
      !contextHiddenFields.includes(key)  // Aplicar ocultos por contexto
    );

  // ... resto do código ...
  // Usar labelOverrides se fornecido
  const getLabel = (key: string) => 
    labelOverrides?.[key] || FIELD_LABELS[key] || key;
}
```

### 5. Criar tratamento especial para registros MX no FormattedCodeEvidence

Modificar a lógica de `FormattedCodeEvidence` para detectar se é um registro MX e aplicar formatação específica:

```typescript
function FormattedCodeEvidence({ item }: FormattedCodeEvidenceProps) {
  // ... código existente ...

  // NOVO: Tratamento especial para registros MX
  // Detectar se é registro MX pelo label ou conteúdo
  const isMxRecord = item.label.includes('MX') || 
    (Array.isArray(parsed) && parsed[0]?.exchange);
  
  if (isMxRecord && Array.isArray(parsed)) {
    // Determinar contexto baseado no label
    // Se for "Redundância MX", mostrar todos os campos
    // Senão, ocultar priority, resolved_ips, resolved_ip_count
    const isRedundancyCheck = item.label.toLowerCase().includes('redundância') ||
                               item.label.toLowerCase().includes('redundancy');
    
    const context = isRedundancyCheck ? 'mx_redundancy' : 'mx_simple';
    
    return (
      <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-3">
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
  
  // ... resto do código ...
}
```

---

## Detalhamento por Card

### Card: Prioridades MX Configuradas
| Campo Original | Ação |
|----------------|------|
| exchange | Exibir como "Servidor MX" |
| priority | **OCULTAR** |
| resolved_ips | **OCULTAR** |
| resolved_ip_count | **OCULTAR** |

### Card: Redundância MX
| Campo Original | Ação |
|----------------|------|
| exchange | Exibir como "Servidor MX" |
| priority | Exibir como "Prioridade" (já existe) |
| resolved_ips | Exibir como "IPs Resolvidos" |
| resolved_ip_count | Exibir como "Quantidade de IPs" |

### Card: Registro MX Configurado
| Campo Original | Ação |
|----------------|------|
| exchange | Exibir como "Servidor MX" |
| priority | **OCULTAR** |
| resolved_ips | **OCULTAR** |
| resolved_ip_count | **OCULTAR** |

### Card: Limite de DNS Lookups SPF
| Campo Original | Tradução |
|----------------|----------|
| data.parsed.includes | "Mecanismos Include" |

### Card: Política SPF Restritiva
| Campo Original | Tradução |
|----------------|----------|
| data.parsed.all | "Política ALL" |

### Card: Registro SPF Configurado
| Campo Original | Tradução |
|----------------|----------|
| data.raw | "Registro SPF" |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Adicionar traduções, criar contexto de campos ocultos, modificar RecordDisplay |

---

## Resultado Visual Esperado

### Prioridades MX Configuradas (DEPOIS)
```
EVIDÊNCIAS COLETADAS
Servidor MX
estrela-com-br.mail.protection.outlook.com
```
*(sem Prioridade, resolved_ips, resolved_ip_count)*

### Redundância MX (DEPOIS)
```
EVIDÊNCIAS COLETADAS
Servidor MX
mx1.example.com

Prioridade
10

IPs Resolvidos
["192.168.1.1", "192.168.1.2"]

Quantidade de IPs
2
```
*(todos os campos traduzidos)*

### Limite de DNS Lookups SPF (DEPOIS)
```
Mecanismos Include
["_spf.google.com", "_spf.outlook.com"]
```

### Política SPF Restritiva (DEPOIS)
```
Política ALL
-all
```

### Registro SPF Configurado (DEPOIS)
```
Registro SPF
v=spf1 include:_spf.google.com ~all
```

---

## Considerações Técnicas

1. **Detecção de contexto**: Usaremos o label do item para determinar qual card está sendo renderizado e aplicar as regras corretas
2. **Fallback seguro**: Se não conseguirmos determinar o contexto, mostramos todos os campos (comportamento atual)
3. **Extensível**: Fácil adicionar novos contextos e regras para outros tipos de checks
