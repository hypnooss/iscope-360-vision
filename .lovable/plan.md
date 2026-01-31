
# Plano: Exibir Evidências Legíveis nos Cards de Domínio Externo

## Objetivo

Adicionar uma seção "EVIDÊNCIAS COLETADAS" nos cards de itens do relatório de Domínio Externo, exibindo as evidências de forma legível para humanos (não como JSON bruto).

---

## Estrutura Proposta

### Card Contraído (sem alteração)
- Nome do card de item
- Descrição da verificação  
- Sugestão de melhoria

### Card Expandido (nova estrutura)
- Endpoint consultado ← somente super admins
- **ANÁLISE EFETUADA**
  - Explicação da análise efetuada
- **EVIDÊNCIAS COLETADAS** ← NOVO
  - Evidências formatadas de forma legível
  - Exemplo para "Diversidade de Nameservers":
    ```
    Nameserver
    ns77.domaincontrol.com
    
    Nameserver  
    ns78.domaincontrol.com
    ```
- Ver dados brutos (JSON) ← somente super admins

---

## Alterações Técnicas

### 1. Arquivo: `src/components/ComplianceCard.tsx`

**Adicionar seção de evidências para variant `external_domain`:**

Após a seção "ANÁLISE EFETUADA" (linha ~154), adicionar:

```tsx
{/* Domínios Externos: "EVIDÊNCIAS COLETADAS" para todos */}
{variant === 'external_domain' && check.evidence && check.evidence.length > 0 && (
  <div className="space-y-2">
    <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
      <FileText className="w-3 h-3" />
      EVIDÊNCIAS COLETADAS
    </h5>
    <div className="space-y-2">
      {check.evidence.map((item, index) => (
        <EvidenceItemDisplay key={index} item={item} />
      ))}
    </div>
  </div>
)}
```

**Criar componente interno `EvidenceItemDisplay`:**

Novo componente para renderizar cada evidência de forma elegante:

```tsx
function EvidenceItemDisplay({ item }: { item: EvidenceItem }) {
  // Detectar se é uma lista (múltiplos valores separados por vírgula)
  const isList = item.value.includes(',') && !item.type?.includes('code');
  
  // Renderização especial para listas (ex: nameservers, registros MX)
  if (isList) {
    const values = item.value.split(',').map(v => v.trim()).filter(Boolean);
    return (
      <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-2">
        {values.map((val, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className="text-sm text-foreground font-mono">{val}</span>
          </div>
        ))}
      </div>
    );
  }
  
  // Renderização para JSON/código
  if (item.type === 'code' || item.type === 'json') {
    // Tentar parsear e formatar de forma legível
    return <FormattedCodeEvidence item={item} />;
  }
  
  // Renderização padrão para texto simples
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30">
      <span className="text-xs font-medium text-muted-foreground block mb-1">{item.label}</span>
      <p className="text-sm text-foreground">{item.value}</p>
    </div>
  );
}
```

**Criar componente `FormattedCodeEvidence` para parsear JSON e exibir de forma legível:**

```tsx
function FormattedCodeEvidence({ item }: { item: EvidenceItem }) {
  // Tentar parsear JSON
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(item.value);
  } catch {
    // Não é JSON válido, exibir como código
  }
  
  // Se for array de objetos (ex: registros DKIM, MX), renderizar como lista
  if (Array.isArray(parsed)) {
    return (
      <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-3">
        <span className="text-xs font-medium text-muted-foreground block">{item.label}</span>
        {parsed.map((record, idx) => (
          <RecordDisplay key={idx} record={record} />
        ))}
      </div>
    );
  }
  
  // Fallback: exibir como código formatado
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30">
      <span className="text-xs font-medium text-muted-foreground block mb-1">{item.label}</span>
      <code className="text-xs text-primary bg-background/50 px-2 py-1 rounded block overflow-x-auto whitespace-pre-wrap">
        {item.value}
      </code>
    </div>
  );
}
```

**Criar componente `RecordDisplay` para exibir registros DNS de forma amigável:**

```tsx
function RecordDisplay({ record }: { record: Record<string, unknown> }) {
  // Mapear campos para labels legíveis
  const fieldLabels: Record<string, string> = {
    name: 'Nome',
    host: 'Host',
    value: 'Valor',
    selector: 'Seletor',
    key_type: 'Tipo de Chave',
    key_size_bits: 'Tamanho da Chave',
    priority: 'Prioridade',
    exchange: 'Servidor MX',
    txt_raw: 'Registro TXT',
    flags: 'Flags',
    // Adicionar mais conforme necessário
  };
  
  // Filtrar campos relevantes (excluir campos técnicos)
  const hiddenFields = ['p_length', 'txt_raw']; // Muito longos/técnicos
  
  const entries = Object.entries(record)
    .filter(([key, value]) => 
      value !== null && 
      value !== undefined && 
      !hiddenFields.includes(key)
    );
  
  return (
    <div className="border-l-2 border-primary/30 pl-3 space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {fieldLabels[key] || key}
          </span>
          <span className="text-sm text-foreground font-mono break-all">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ComplianceCard.tsx` | Adicionar seção "EVIDÊNCIAS COLETADAS" para external_domain + componentes de formatação |

---

## Resultado Visual Esperado

**Antes (card expandido):**
```
ANÁLISE EFETUADA
[Texto da análise]

Ver dados brutos (JSON) ← super admin only
```

**Depois (card expandido):**
```
ANÁLISE EFETUADA
[Texto da análise]

EVIDÊNCIAS COLETADAS
┌─────────────────────────────────────┐
│ Nameserver                          │
│ ns77.domaincontrol.com              │
├─────────────────────────────────────┤
│ Nameserver                          │
│ ns78.domaincontrol.com              │
└─────────────────────────────────────┘

Ver dados brutos (JSON) ← super admin only
```

---

## Exemplos de Formatação por Tipo de Check

| Check | Dados Brutos | Exibição Legível |
|-------|--------------|------------------|
| Nameservers | `["ns77.domaincontrol.com", "ns78.domaincontrol.com"]` | Duas linhas: "Nameserver: ns77..." / "Nameserver: ns78..." |
| DKIM | `[{selector: "selector1", key_type: "rsa", key_size_bits: 2048}]` | "Seletor: selector1" / "Tipo: RSA" / "Tamanho: 2048 bits" |
| MX | `[{exchange: "mx1.example.com", priority: 10}]` | "Servidor MX: mx1.example.com" / "Prioridade: 10" |
| SPF | `{record: "v=spf1 include:_spf.google.com ~all"}` | "Registro SPF: v=spf1 include:_spf.google.com ~all" |
| DMARC | `{policy: "reject", rua: "mailto:..."}` | "Política: reject" / "Relatórios (rua): mailto:..." |

---

## Considerações

1. **Visibilidade**: As evidências serão visíveis para todos os usuários (não apenas super admins), pois são informações importantes para entender o resultado da análise

2. **Fallback**: Se o parsing falhar, o sistema exibirá o valor original como texto simples

3. **Responsividade**: Os campos longos (como chaves DKIM) terão `break-all` para não quebrar o layout

4. **Consistência**: O estilo visual será consistente com o resto do card (cores, bordas, espaçamento)
