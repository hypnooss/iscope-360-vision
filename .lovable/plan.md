

## Inverter Ordem das Linhas nos Cards SOA e TXT

### Problema Identificado

Nas seções **SOA** e **TXT (Email Auth)**, as linhas estão invertidas:

| Seção | Atual | Esperado |
|-------|-------|----------|
| SOA Primary | `ns1-06.azure-dns.com` / `Primary` | `Primary` / `ns1-06.azure-dns.com` |
| SOA Contact | `email@...` / `Contact` | `Contact` / `email@...` |
| SOA DNSSEC | `Inativo` / `DNSSEC` | `DNSSEC` / `Inativo` |
| SPF | `v=spf1...` / `SPF` | `SPF` / `v=spf1...` |
| DKIM | `selector1` / `DKIM - 2352 bits` | `selector1` / `Tamanho da chave - 2352 bits` |
| DMARC | `p=reject, sp=reject` / `DMARC` | `DMARC` / `Política: reject` + `Política Subdomínios: reject` |

---

### Solução

Inverter a ordem dos parâmetros nas chamadas do `ValueCard` para SOA e TXT:

---

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

#### 1. Seção SOA (linhas ~212-228)

**Antes:**
```typescript
<ValueCard primary={soaMname} secondary="Primary" />
<ValueCard primary={soaContact} secondary="Contact" />
<ValueCard primary={dnssecActive ? 'Ativo' : 'Inativo'} secondary="DNSSEC" />
```

**Depois:**
```typescript
<ValueCard primary="Primary" secondary={soaMname} />
<ValueCard primary="Contact" secondary={soaContact} />
<ValueCard primary="DNSSEC" secondary={dnssecActive ? 'Ativo' : 'Inativo'} isActive={dnssecActive} />
```

#### 2. Seção TXT - SPF (linhas ~240-244)

**Antes:**
```typescript
<ValueCard 
  primary={spfRecord || 'Não encontrado'} 
  secondary="SPF"
  isActive={emailAuth?.spf}
/>
```

**Depois:**
```typescript
<ValueCard 
  primary="SPF" 
  secondary={spfRecord || 'Não encontrado'}
  isActive={emailAuth?.spf}
/>
```

#### 3. Seção TXT - DKIM (linhas ~246-254)

**Antes:**
```typescript
<ValueCard
  primary={key.selector}
  secondary={`DKIM${key.keySize ? ` - ${key.keySize} bits` : ''}`}
/>
```

**Depois:**
```typescript
<ValueCard
  primary={key.selector}
  secondary={key.keySize ? `Tamanho da chave - ${key.keySize} bits` : 'Tamanho desconhecido'}
/>
```

#### 4. Seção TXT - DMARC (linhas ~262-268)

**Antes:**
```typescript
<ValueCard 
  primary={dmarcPolicy.p ? `p=${dmarcPolicy.p}${dmarcPolicy.sp ? `, sp=${dmarcPolicy.sp}` : ''}` : 'Não encontrado'} 
  secondary="DMARC"
/>
```

**Depois:**
```typescript
<ValueCard 
  primary="DMARC" 
  secondary={
    dmarcPolicy.p 
      ? `Política: ${dmarcPolicy.p}${dmarcPolicy.sp ? `\nPolítica Subdomínios: ${dmarcPolicy.sp}` : ''}`
      : 'Não encontrado'
  }
/>
```

---

### Resultado Visual Esperado

**SOA:**
```text
┌─────────────────────────────────────────────────────────────┐
│  ● Primary                                                   │
│    ns1-06.azure-dns.com                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● Contact                                                   │
│    azuredns-hostmaster@microsoft.com                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ○ DNSSEC                                                    │
│    Inativo                                                   │
└─────────────────────────────────────────────────────────────┘
```

**TXT (Email Auth):**
```text
┌─────────────────────────────────────────────────────────────┐
│  ● SPF                                                       │
│    v=spf1 include:spf.protection.outlook.com...              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● selector1                                                 │
│    Tamanho da chave - 2352 bits                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● DMARC                                                     │
│    Política: reject                                          │
│    Política Subdomínios: reject                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Resumo

| Seção | Linha 1 (Primary) | Linha 2 (Secondary) |
|-------|-------------------|---------------------|
| NS | Hostname | IPs (sem mudança) |
| SOA | Label (Primary/Contact/DNSSEC) | Valor |
| MX | Exchange | Prioridade + IPs (sem mudança) |
| SPF | "SPF" | Registro completo |
| DKIM | Nome do seletor | "Tamanho da chave - X bits" |
| DMARC | "DMARC" | Política + Política Subdomínios |
| Subdomínios | Hostname | IPs (sem mudança) |

---

### Arquivo Modificado

- `src/components/pdf/sections/PDFDNSMap.tsx`

