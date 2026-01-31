

# Plano: Correção da Exibição de Evidências para Domínios Externos

## Diagnóstico dos Problemas

Após análise detalhada do código e dados do banco, identifiquei as seguintes causas raiz:

### 1. Conflito de Tradução `data.records`
- O label `data.records` é traduzido genericamente para `"Nameservers"` (linha 43)
- Isso afeta TANTO registros NS quanto MX, causando comportamento incorreto para MX
- O código de tratamento de Nameservers (linhas 222-249) intercepta o processamento antes da detecção de MX

### 2. Detecção de Contexto Impossível
- A detecção de "Redundância" vs "Simples" depende do label conter "redundância"
- Mas os labels são técnicos (`data.records`, `data.found`), não contêm nome do check
- Após tradução, `data.records` vira `"Nameservers"`, não "Redundância MX"

### 3. Evidências Vazias no Backend
- Checks DMARC-003 (RUA), DMARC-005 (aspf) e DMARC-006 (adkim) retornam `evidence: null`
- O backend não gera evidências para esses campos usando `formatGenericEvidence`
- Isso acontece porque o campo avaliado é simples (string) mas o backend não está formatando

---

## Solução Proposta

### Estratégia: Detecção pelo Conteúdo ANTES da Tradução

Modificar a ordem de processamento para detectar o tipo de registro pelo conteúdo JSON ANTES de aplicar traduções de label.

### Alterações em `src/components/compliance/EvidenceDisplay.tsx`

#### 1. Mover detecção de MX/DKIM para ANTES do tratamento de Nameservers

```typescript
function FormattedCodeEvidence({ item }: FormattedCodeEvidenceProps) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(item.value);
  } catch {
    // Não é JSON válido
  }

  // PRIMEIRO: Detectar tipo pelo conteúdo JSON (antes de verificar labels)
  const isDkimByContent = Array.isArray(parsed) && 
    parsed.length > 0 && 
    typeof parsed[0] === 'object' && 
    (parsed[0] as Record<string, unknown>).selector !== undefined;

  const isMxByContent = Array.isArray(parsed) && 
    parsed.length > 0 && 
    typeof parsed[0] === 'object' && 
    (parsed[0] as Record<string, unknown>).exchange !== undefined;

  // Detecção DKIM (por conteúdo OU label)
  if (isDkimByContent || item.label.includes('DKIM') || item.label === 'data.found') {
    // ... código DKIM
  }

  // Detecção MX (por conteúdo OU label) - ANTES de Nameservers!
  if (isMxByContent || item.label.includes('MX')) {
    // ... código MX
  }

  // DEPOIS: Tratamento de Nameservers (apenas se não foi MX/DKIM)
  if (item.label === 'data.records' || item.label === 'Nameservers') {
    // ... código Nameservers (só para NS records)
  }
```

#### 2. Não depender do label para contexto - usar heurística alternativa

Como não temos acesso ao nome do check, usaremos uma heurística baseada em:
- **Redundância**: Todos os MX com todos os campos (IPs, prioridade)
- **Simples**: MX simplificado (só exchange)

Para DKIM:
- **DKIM Configurado**: Mostrar apenas contagem
- **Redundância DKIM**: Mostrar nomes das chaves

Implementar isso passando informação de contexto através de um novo campo ou detectando pelo número de checks que usam os mesmos dados.

**Solução pragmática**: Como não podemos detectar qual check está renderizando, vamos mostrar SEMPRE os dados completos traduzidos de forma legível. Usuário técnico verá mais detalhes, mas todos os campos estarão em português.

#### 3. Corrigir a tradução de `data.records`

Remover a tradução genérica de `data.records` para evitar conflitos:

```typescript
// REMOVER esta linha:
// 'data.records': 'Nameservers',

// A detecção de NS vs MX será feita pelo conteúdo
```

#### 4. Simplificar tratamento DKIM

Para DKIM, mostrar informações legíveis ao invés de JSON bruto:

```typescript
if (isDkimByContent) {
  return (
    <div className="...">
      {parsed.map((record, idx) => {
        const rec = record as Record<string, unknown>;
        return (
          <div key={idx} className="border-l-2 ...">
            <div className="flex flex-col">
              <span className="text-xs ...">Seletor</span>
              <span className="text-sm ...">{rec.selector || rec.name}</span>
            </div>
            {rec.key_type && (
              <div className="flex flex-col">
                <span className="text-xs ...">Tipo de Chave</span>
                <span className="text-sm ...">{rec.key_type}</span>
              </div>
            )}
            {rec.key_size_bits && (
              <div className="flex flex-col">
                <span className="text-xs ...">Tamanho da Chave</span>
                <span className="text-sm ...">{rec.key_size_bits} bits</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

#### 5. Corrigir tratamento MX para mostrar todos os campos traduzidos

```typescript
if (isMxByContent) {
  return (
    <div className="...">
      {parsed.map((record, idx) => {
        const rec = record as Record<string, unknown>;
        const ips = rec.resolved_ips;
        const ipsDisplay = Array.isArray(ips) ? ips.join(', ') : '';
        
        return (
          <div key={idx} className="border-l-2 ...">
            <div className="flex flex-col">
              <span className="text-xs ...">Servidor MX</span>
              <span className="text-sm ...">{rec.exchange}</span>
            </div>
            {rec.priority !== undefined && (
              <div className="flex flex-col">
                <span className="text-xs ...">Prioridade</span>
                <span className="text-sm ...">{rec.priority}</span>
              </div>
            )}
            {ipsDisplay && (
              <div className="flex flex-col">
                <span className="text-xs ...">IPs Resolvidos</span>
                <span className="text-sm ...">{ipsDisplay}</span>
              </div>
            )}
            {rec.resolved_ip_count && (
              <div className="flex flex-col">
                <span className="text-xs ...">Quantidade de IPs</span>
                <span className="text-sm ...">{rec.resolved_ip_count}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Problema das Evidências Vazias (Backend)

Os checks DMARC-003, DMARC-005 e DMARC-006 não geram evidências porque o backend usa `formatGenericEvidence` apenas quando `value !== undefined`, mas não está gerando evidências para esses campos específicos.

### Solução: Atualizar a Edge Function `agent-task-result`

Expandir `formatExternalDomainEvidence` para incluir tratamento de SPF, DMARC e DKIM:

```typescript
function formatExternalDomainEvidence(stepId: string, sourceData: unknown): EvidenceItem[] {
  // ... código existente para ns_records, soa_record, dnssec_status ...

  if (stepId === 'dmarc_record') {
    const d = (data && typeof data === 'object') ? (data as Record<string, unknown>) : undefined;
    const parsed = d?.parsed as Record<string, unknown> | undefined;
    const evidence: EvidenceItem[] = [];
    
    if (d?.raw) {
      evidence.push({ label: 'data.raw', value: String(d.raw), type: 'text' });
    }
    if (parsed?.p) {
      evidence.push({ label: 'data.parsed.p', value: String(parsed.p), type: 'text' });
    }
    if (parsed?.sp) {
      evidence.push({ label: 'data.parsed.sp', value: String(parsed.sp), type: 'text' });
    }
    if (parsed?.aspf) {
      evidence.push({ label: 'data.parsed.aspf', value: String(parsed.aspf), type: 'text' });
    }
    if (parsed?.adkim) {
      evidence.push({ label: 'data.parsed.adkim', value: String(parsed.adkim), type: 'text' });
    }
    if (parsed?.rua) {
      evidence.push({ label: 'data.parsed.rua', value: String(parsed.rua), type: 'text' });
    }
    if (parsed?.ruf) {
      evidence.push({ label: 'data.parsed.ruf', value: String(parsed.ruf), type: 'text' });
    }
    if (parsed?.pct !== undefined) {
      evidence.push({ label: 'data.parsed.pct', value: String(parsed.pct), type: 'text' });
    }
    
    return evidence;
  }

  // Similar para spf_record, dkim_records, mx_records
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Reordenar detecção (conteúdo antes de label), corrigir formatação DKIM/MX |
| `supabase/functions/agent-task-result/index.ts` | Expandir `formatExternalDomainEvidence` para gerar evidências DMARC/SPF/DKIM |

---

## Resultado Esperado

### Redundância MX (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Servidor MX
precisio-io.mail.protection.outlook.com

Prioridade
0

IPs Resolvidos
52.101.11.17, 52.101.42.13, ...

Quantidade de IPs
8
```

### DKIM Configurado (CORRIGIDO)
```
EVIDÊNCIAS COLETADAS

Seletor
selector1

Tipo de Chave
rsa

Tamanho da Chave
2352 bits
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

