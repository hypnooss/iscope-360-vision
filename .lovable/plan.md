
## Reformular Cards de Valores no Mapa DNS do PDF

### Objetivo

Separar visualmente o **header da categoria** dos **cards de valor**, onde cada valor terá:
- Linha 1: Valor principal (hostname)
- Linha 2: Valor secundário (IPs, prioridade, etc.)
- Status dot à esquerda
- Card ocupando largura horizontal total

---

### Estrutura Visual Desejada

Baseado na referência (print do usuário):

```text
┌─────────────────────────────────────────────────────────────────┐
│  NS                                                              │  ← Header Sky (card de categoria)
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ● ns1-06.azure-dns.com                                         │  ← Card de valor
│    13.107.236.6, 2603:1061:0:700::6                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ● ns2-06.azure-dns.net                                         │  ← Card de valor
│    13.107.222.6, 2603:1061:2300::6                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### Mudanças Técnicas

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

#### 1. Novos Estilos

```typescript
// Valor card (estilo similar ao card de info SPF/DKIM)
valueCard: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  backgroundColor: colors.cardBg,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 10,
  marginBottom: 6,
},
statusDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  marginTop: 3,
  marginRight: 10,
},
valueContent: {
  flex: 1,
},
valuePrimary: {
  fontSize: typography.bodySmall,
  fontFamily: typography.bold,
  color: colors.textPrimary,
  marginBottom: 2,
},
valueSecondary: {
  fontSize: typography.caption,
  color: colors.textMuted,
},
```

#### 2. Novo Componente `ValueCard`

Exibir valor principal e secundário em linhas separadas:

```typescript
interface ValueCardProps {
  primary: string;
  secondary?: string;
  isActive?: boolean;
}

function ValueCard({ primary, secondary, isActive = true }: ValueCardProps) {
  return (
    <View style={styles.valueCard}>
      <View style={[
        styles.statusDot, 
        { backgroundColor: isActive ? colors.success : colors.textMuted }
      ]} />
      <View style={styles.valueContent}>
        <Text style={styles.valuePrimary}>{primary}</Text>
        {secondary && (
          <Text style={styles.valueSecondary}>{secondary}</Text>
        )}
      </View>
    </View>
  );
}
```

#### 3. Reformular `DNSCard`

O header da categoria fica separado, sem incluir os valores dentro do mesmo card:

```typescript
function CategoryHeader({ title, color }: { title: string; color: string }) {
  return (
    <View style={[styles.categoryHeader, { backgroundColor: color }]}>
      <Text style={styles.categoryHeaderText}>{title}</Text>
    </View>
  );
}
```

#### 4. Aplicar em Cada Seção

**NS:**
```typescript
<CategoryHeader title="NS" color={headerColors.ns} />
{nsRecords.map((ns, idx) => (
  <ValueCard
    key={idx}
    primary={ns.host}
    secondary={ns.resolvedIps.length > 0 ? ns.resolvedIps.join(', ') : undefined}
  />
))}
```

**MX:**
```typescript
<CategoryHeader title="MX" color={headerColors.mx} />
{mxRecords.map((mx, idx) => (
  <ValueCard
    key={idx}
    primary={mx.exchange}
    secondary={`Prioridade: ${mx.priority}${mx.ips.length ? ` • ${mx.ips.join(', ')}` : ''}`}
  />
))}
```

**SOA:**
```typescript
<CategoryHeader title="SOA" color={headerColors.soa} />
<ValueCard primary={dnsSummary?.soaMname || 'N/A'} secondary="Primary" />
<ValueCard primary={dnsSummary?.soaContact || 'N/A'} secondary="Contact" />
<ValueCard 
  primary={dnssecActive ? 'Ativo' : 'Inativo'} 
  secondary="DNSSEC"
  isActive={dnssecActive}
/>
```

**TXT (Email Auth):**
```typescript
<CategoryHeader title="TXT (Email Auth)" color={headerColors.txt} />
<ValueCard 
  primary={spfRecord || 'Não encontrado'} 
  secondary="SPF"
  isActive={emailAuth?.spf}
/>
{dkimKeys.map((key, idx) => (
  <ValueCard
    key={idx}
    primary={key.selector}
    secondary={`DKIM${key.keySize ? ` • ${key.keySize} bits` : ''}`}
    isActive={emailAuth?.dkim}
  />
))}
<ValueCard 
  primary={dmarcPolicy.p ? `p=${dmarcPolicy.p}${dmarcPolicy.sp ? `, sp=${dmarcPolicy.sp}` : ''}` : 'Não encontrado'} 
  secondary="DMARC"
  isActive={emailAuth?.dmarc}
/>
```

**Subdomínios:**
```typescript
<CategoryHeader title="Subdomínios" color={headerColors.subdomain} />
{activeSubdomains.map((sub, idx) => (
  <ValueCard
    key={idx}
    primary={sub.subdomain}
    secondary={sub.addresses?.map(a => a.ip).join(', ') || undefined}
  />
))}
```

---

### Layout Final Esperado

```text
Mapa de Infraestrutura DNS                    ← Título teal

┌─────────────────────────────────────────────────────────────┐
│  NS                                                          │  ← Header Sky
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● ns1-06.azure-dns.com                                      │
│    13.107.236.6, 2603:1061:0:700::6                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● ns2-06.azure-dns.net                                      │
│    13.107.222.6, 2603:1061:2300::6                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SOA                                                         │  ← Header Amber
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● ns1-06.azure-dns.com                                      │
│    Primary                                                   │
└─────────────────────────────────────────────────────────────┘
...

```

---

### Resumo das Alterações

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Estrutura | Header + valores no mesmo card | Header separado dos value cards |
| Valores | Uma linha apenas | Duas linhas (principal + secundário) |
| Estilo | Simples com dot + texto | Card individual com borda, padding |
| Subdomínios | Grid 2 colunas | Value cards individuais |

---

### Arquivo Modificado

- `src/components/pdf/sections/PDFDNSMap.tsx` (reescrita completa)
