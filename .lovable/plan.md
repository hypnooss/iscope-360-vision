
# Plano: Evidências Humanizadas para Domínio Externo

## Diagnóstico

Analisei o código e confirmei:

**Onde está a inteligência de negócio:**
A lógica está no backend, especificamente na edge function `supabase/functions/agent-task-result/index.ts`:
- **Função `formatExternalDomainEvidence()`** (linhas 1746-1812): Transforma dados brutos em evidências legíveis
- **Função `formatGenericEvidence()`** (linhas 1719-1744): Fallback genérico que mostra `data.records`, `data.has_dnskey` como labels — é por isso que aparecem nomes técnicos

O problema é que nem todos os tipos de checks têm formatação específica, então o fallback genérico mostra o path do campo como label.

---

## Solução Proposta

Temos **duas opções**:

### Opção A: Corrigir no Backend (Recomendado)
Expandir a função `formatExternalDomainEvidence()` para cobrir TODOS os tipos de checks de domínio externo com evidências humanizadas.

**Vantagens:**
- Resolve na raiz do problema
- Todos os clientes (web, API, futuras integrações) recebem dados formatados
- Não depende do frontend para traduzir

**Desvantagens:**
- Requer deploy da edge function

### Opção B: Corrigir no Frontend
Criar lógica de transformação no componente `EvidenceDisplay.tsx` que interpreta os labels técnicos e traduz para português.

**Vantagens:**
- Mais rápido para testar
- Não requer deploy de edge function

**Desvantagens:**
- Duplica lógica (frontend + backend)
- Se outro cliente consumir a API, receberá dados técnicos

---

## Recomendação: Combinação

1. **Frontend imediato** para melhorar a UX agora
2. **Backend futuro** para resolver na raiz

---

## Alterações no Frontend

### Arquivo: `src/components/compliance/EvidenceDisplay.tsx`

#### 1. Adicionar mapeamento de labels técnicos → legíveis

```typescript
// Mapa de labels técnicos para labels amigáveis
const LABEL_TRANSLATIONS: Record<string, string> = {
  'data.records': 'Nameservers',       // Ocultar para ns_records
  'data.has_dnskey': 'Status',
  'data.has_ds': 'Registro DS',
  'data.validated': 'Validação DNSSEC',
  'data.mname': 'Servidor Primário',
  'data.contact_email': 'Contato do Administrador',
  'Nameservers encontrados': 'Nameservers',
  'DNSKEY': 'Status DNSKEY',
  'DS': 'Status DS',
  'Validated': 'Validação',
  'SOA mname': 'Nameserver Primário',
  'SOA contact': 'Email do Responsável',
};
```

#### 2. Adicionar mapeamento de valores booleanos → legíveis

```typescript
// Mapa de valores booleanos/técnicos para valores legíveis
const VALUE_TRANSFORMATIONS: Record<string, Record<string, string>> = {
  'data.has_dnskey': {
    'true': 'DNSSEC Ativado',
    'false': 'DNSSEC Desativado',
  },
  'DNSKEY': {
    'true': 'Presente ✓',
    'false': 'Ausente ✗',
  },
  'DS': {
    'true': 'Presente ✓',
    'false': 'Ausente ✗',
  },
  'data.validated': {
    'true': 'Validação OK ✓',
    'false': 'Não validado',
    'unknown': 'Não verificado',
    'partial': 'Parcialmente validado',
  },
};
```

#### 3. Adicionar lista de labels a ocultar

```typescript
// Labels que devem ser completamente ocultos (não aparecem na UI)
const HIDDEN_LABELS = ['data.records'];
```

#### 4. Modificar `EvidenceItemDisplay` para usar as traduções

```typescript
export function EvidenceItemDisplay({ item }: EvidenceItemDisplayProps) {
  // Ocultar labels específicos
  if (HIDDEN_LABELS.includes(item.label)) {
    return null;
  }
  
  // Traduzir label
  const translatedLabel = LABEL_TRANSLATIONS[item.label] || item.label;
  
  // Traduzir valor se houver transformação
  const transformedValue = VALUE_TRANSFORMATIONS[item.label]?.[item.value] || item.value;
  
  // ... resto da lógica de renderização usando translatedLabel e transformedValue
}
```

#### 5. Atualizar `FIELD_LABELS` para incluir host → Nameserver

```typescript
const FIELD_LABELS: Record<string, string> = {
  // ... existentes ...
  host: 'Nameserver',  // Alterado de 'Host' para 'Nameserver'
};
```

---

## Resultado Visual Esperado

### Diversidade de Nameservers

**Antes:**
```
data.records
├─ Host
│  ns77.domaincontrol.com
├─ Host
│  ns78.domaincontrol.com
```

**Depois:**
```
Nameserver
ns77.domaincontrol.com

Nameserver
ns78.domaincontrol.com
```

### DNSSEC Habilitado

**Antes:**
```
data.has_dnskey
false
```

**Depois:**
```
Status
DNSSEC Desativado
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Adicionar mapas de tradução e transformação de labels/valores |

---

## Considerações

1. **Extensível**: Os mapas podem ser facilmente expandidos para novos tipos de checks
2. **Fallback**: Se um label não tiver tradução, mostra o original
3. **Manutenção**: Centralizado em um único arquivo
4. **Futuro**: Quando o backend for atualizado, o frontend vai funcionar com ambos os formatos

---

## Próximos Passos

Após implementar, podemos validar check por check e adicionar mais traduções conforme necessário.
