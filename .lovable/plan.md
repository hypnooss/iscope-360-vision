
# Plano: Humanização de Evidências DKIM/DMARC e Nova Regra

## Resumo das Alterações

### 1. Traduções de Labels (Frontend)

Adicionar mapeamentos para todos os labels técnicos identificados:

| Label Técnico | Tradução |
|--------------|----------|
| `data.found` / `data.found[]` | Ocultar/Processar como lista DKIM |
| `data.parsed.aspf` | Alinhamento SPF |
| `data.parsed.adkim` | Alinhamento DKIM |
| `data.parsed.pct` | Cobertura |
| `data.parsed.p` | Política DMARC |
| `data.parsed.sp` | Política de Subdomínio |
| `data.parsed.rua` | Relatórios (RUA) |
| `data.parsed.ruf` | Relatórios Forenses (RUF) |
| `data.raw` (contexto DMARC) | Registro DMARC |

### 2. Transformações de Valores (Frontend)

Para tornar valores técnicos compreensíveis:

| Campo | Valor Original | Valor Humanizado |
|-------|---------------|------------------|
| `data.parsed.aspf` | `r` | Relaxado (r) |
| `data.parsed.aspf` | `s` | Estrito (s) ✓ |
| `data.parsed.adkim` | `r` | Relaxado (r) |
| `data.parsed.adkim` | `s` | Estrito (s) ✓ |
| `data.parsed.p` | `reject` | Rejeitar (reject) ✓ |
| `data.parsed.p` | `quarantine` | Quarentena (quarantine) |
| `data.parsed.p` | `none` | Nenhuma (none) ✗ |
| `data.parsed.sp` | `reject` | Rejeitar (reject) ✓ |
| `data.parsed.sp` | `quarantine` | Quarentena (quarantine) |
| `data.parsed.sp` | `none` | Nenhuma (none) ✗ |
| `data.parsed.pct` | `100` | 100% (cobertura total) ✓ |

### 3. Tratamento Especial para DKIM (Frontend)

Criar handler específico para `data.found` que exibe registros DKIM de forma legível:

```
EVIDÊNCIAS COLETADAS

Seletor
default

Tipo de Chave
rsa

Tamanho da Chave (bits)
2048
```

### 4. Tratamento Especial para Política DMARC (Frontend)

No card "Política DMARC Restritiva", exibir AMBAS as políticas (p e sp):

```
EVIDÊNCIAS COLETADAS

Política DMARC
Rejeitar (reject) ✓

Política de Subdomínio
Rejeitar (reject) ✓
```

### 5. Corrigir Label "Registro SPF" em DMARC (Frontend)

O label `data.raw` deve ser traduzido para "Registro DMARC" quando no contexto de DMARC, não "Registro SPF".

---

## Alterações no Frontend

### Arquivo: `src/components/compliance/EvidenceDisplay.tsx`

#### 1. Expandir LABEL_TRANSLATIONS

```typescript
const LABEL_TRANSLATIONS: Record<string, string> = {
  // ... existentes ...
  
  // DKIM translations
  'data.found': 'Registros DKIM',
  'data.found[]': 'Registros DKIM',
  'data.found[0].key_size_bits': 'Tamanho da Chave (bits)',
  
  // DMARC translations
  'data.parsed.aspf': 'Alinhamento SPF',
  'data.parsed.adkim': 'Alinhamento DKIM',
  'data.parsed.pct': 'Cobertura',
  'data.parsed.p': 'Política DMARC',
  'data.parsed.sp': 'Política de Subdomínio',
  'data.parsed.rua': 'Relatórios (RUA)',
  'data.parsed.ruf': 'Relatórios Forenses (RUF)',
};
```

#### 2. Expandir VALUE_TRANSFORMATIONS

```typescript
const VALUE_TRANSFORMATIONS: Record<string, Record<string, string>> = {
  // ... existentes ...
  
  // DMARC alignment values
  'data.parsed.aspf': {
    'r': 'Relaxado (r)',
    's': 'Estrito (s) ✓',
  },
  'data.parsed.adkim': {
    'r': 'Relaxado (r)',
    's': 'Estrito (s) ✓',
  },
  
  // DMARC policy values
  'data.parsed.p': {
    'reject': 'Rejeitar (reject) ✓',
    'quarantine': 'Quarentena (quarantine)',
    'none': 'Nenhuma (none) ✗',
  },
  'data.parsed.sp': {
    'reject': 'Rejeitar (reject) ✓',
    'quarantine': 'Quarentena (quarantine)',
    'none': 'Nenhuma (none) ✗',
  },
  
  // DMARC coverage
  'data.parsed.pct': {
    '100': '100% (cobertura total) ✓',
  },
};
```

#### 3. Criar tratamento especial para DKIM em FormattedCodeEvidence

```typescript
// Detectar se é registro DKIM
const isDkimRecord = item.label.includes('DKIM') || 
  item.label === 'data.found' || 
  item.label === 'data.found[]' ||
  (Array.isArray(parsed) && parsed[0]?.selector !== undefined);

if (isDkimRecord && Array.isArray(parsed)) {
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-3">
      {parsed.map((record, idx) => (
        <RecordDisplay 
          key={idx} 
          record={record as Record<string, unknown>}
          labelOverrides={{ 
            selector: 'Seletor',
            key_type: 'Tipo de Chave',
            key_size_bits: 'Tamanho da Chave (bits)',
          }}
        />
      ))}
    </div>
  );
}
```

#### 4. Criar lógica para detectar contexto DMARC vs SPF

O label `data.raw` precisa ser traduzido corretamente baseado no contexto:
- Em cards SPF → "Registro SPF"  
- Em cards DMARC → "Registro DMARC"

Isso pode ser feito detectando o conteúdo (v=DMARC1 vs v=spf1).

---

## Alterações no Backend (Banco de Dados)

### Nova regra: DMARC-006 (Alinhamento DKIM Estrito)

Criar via SQL:

```sql
INSERT INTO compliance_rules (
  device_type_id,
  code,
  name,
  description,
  category,
  severity,
  weight,
  evaluation_logic,
  pass_description,
  fail_description,
  recommendation,
  is_active
) VALUES (
  'd5562218-5a3d-4ca6-9591-03e220dbf7e1',  -- Domínio Externo
  'DMARC-006',
  'Alinhamento DKIM Estrito',
  'Verifica se o DMARC exige alinhamento estrito de DKIM (adkim=s).',
  'Autenticação de Email - DMARC',
  'low',
  3,
  '{"field": "data.parsed.adkim", "operator": "eq", "step_id": "dmarc_record", "value": "s"}',
  'Alinhamento DKIM estrito está configurado.',
  'Alinhamento DKIM relaxado permite subdomínios, reduzindo proteção.',
  'Adicione "adkim=s" ao DMARC para exigir correspondência exata do domínio DKIM.',
  true
);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Adicionar traduções DKIM/DMARC, tratamento especial para arrays DKIM, lógica de contexto SPF/DMARC |

## SQL a Executar

| Tabela | Operação |
|--------|----------|
| `compliance_rules` | INSERT da regra DMARC-006 |

---

## Resultado Visual Esperado

### DKIM Configurado (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Seletor
default

Tipo de Chave
rsa

Tamanho da Chave (bits)
2048
```

### Alinhamento SPF Estrito (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Alinhamento SPF
Relaxado (r)
```

### Alinhamento DKIM Estrito (NOVO CARD)
```
EVIDÊNCIAS COLETADAS

Alinhamento DKIM
Estrito (s) ✓
```

### Política DMARC Restritiva (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Política DMARC
Rejeitar (reject) ✓

Política de Subdomínio
Rejeitar (reject) ✓
```

### DMARC Configurado (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Registro DMARC
v=DMARC1;p=reject;sp=reject;...
```

### Cobertura DMARC Total (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Cobertura
100% (cobertura total) ✓
```

### Relatórios DMARC (RUA) (DEPOIS)
```
EVIDÊNCIAS COLETADAS

Relatórios (RUA)
mailto:db93c273a8@rua.easydmarc.com
```

---

## Considerações Técnicas

1. **Detecção de contexto DMARC/SPF**: Usaremos o conteúdo do registro (`v=DMARC1` vs `v=spf1`) para determinar a tradução correta de `data.raw`
2. **Política de subdomínio**: Será extraída do mesmo registro DMARC e exibida junto com a política principal
3. **Nova regra DMARC-006**: Seguirá o mesmo padrão da DMARC-005 (aspf), mas para adkim
4. **Fallback seguro**: Labels não traduzidos continuam funcionando
