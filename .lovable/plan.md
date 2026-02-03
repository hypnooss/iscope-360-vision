
## Reorganizar Mapa DNS para Layout de Coluna Única

### Problema Identificado

O layout atual de 3 colunas comprime as informações em espaços muito pequenos, causando:
- Textos truncados prematuramente
- Informações sobrepostas ou cortadas
- Dificuldade de leitura no PDF impresso

### Solução

Converter o layout de 3 colunas para **uma única coluna vertical** que ocupa a largura total da página A4, permitindo exibir as informações com clareza.

---

### Novo Layout Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│  ●  Mapa de Infraestrutura DNS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │ NS            4          │  │ SOA                   1      │ │
│  │ ns1-06.azure-dns.com     │  │ Primary: ns1-06.azure-dns.c. │ │
│  │ ns2-06.azure-dns.net     │  │ Contact: azuredns-hostmast.. │ │
│  │ ns3-06.azure-dns.org     │  │ ● DNSSEC: Inativo            │ │
│  │ ns4-06.azure-dns.info    │  └──────────────────────────────┘ │
│  └──────────────────────────┘                                   │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │ MX            1          │  │ TXT (Email Auth)      3      │ │
│  │ taschibra-com-br.mail... │  │ ● SPF  v=spf1 include:spf... │ │
│  │ Prioridade: 0            │  │ ● DKIM sel1 - 2352 bits      │ │
│  └──────────────────────────┘  │ ● DMARC p=reject, sp=reject  │ │
│                                └──────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ Subdomínios                                          11     │ │
│  ├──────────────────────────────────────────────────────────────┤
│  │ ● chat.taschibra.com.br      ● ns1.taschibra.com.br         │ │
│  │ ● drive.taschibra.com.br     ● ns2.taschibra.com.br         │ │
│  │ ● ida-fw.taschibra.com.br    ● ns3.taschibra.com.br         │ │
│  │ ● mail.taschibra.com.br      ● vpn.taschibra.com.br         │ │
│  │ ● mx2.taschibra.com.br       ● www.mail.taschibra.com.br    │ │
│  │                              ● www.taschibra.com.br         │ │
│  └──────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Estrutura Proposta

**Linha 1**: NS (esquerda) + SOA/DNSSEC (direita) - 2 cards lado a lado (50%/50%)

**Linha 2**: MX (esquerda) + TXT/Email Auth (direita) - 2 cards lado a lado (50%/50%)

**Linha 3**: Subdomínios - card de largura total com 2 colunas internas

Esta abordagem mantém a organização lógica mas dá muito mais espaço horizontal para cada informação.

---

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

#### 1. Substituir estrutura de 3 colunas por linhas de 2 colunas

**Layout Atual (3 colunas):**
```typescript
<View style={styles.grid}>
  <View style={styles.column}>  {/* NS + MX */}
  <View style={styles.column}>  {/* SOA + TXT */}
  <View style={styles.columnLast}>  {/* Subdomains */}
</View>
```

**Novo Layout (linhas de 2 colunas):**
```typescript
<View style={styles.content}>
  {/* Row 1: NS + SOA */}
  <View style={styles.row}>
    <View style={styles.halfColumn}>{/* NS */}</View>
    <View style={styles.halfColumnLast}>{/* SOA */}</View>
  </View>
  
  {/* Row 2: MX + TXT */}
  <View style={styles.row}>
    <View style={styles.halfColumn}>{/* MX */}</View>
    <View style={styles.halfColumnLast}>{/* TXT */}</View>
  </View>
  
  {/* Row 3: Subdomains - full width */}
  <View style={styles.fullWidthCard}>{/* Subdomains */}</View>
</View>
```

#### 2. Novos estilos

```typescript
const styles = StyleSheet.create({
  // ... estilos existentes ...
  
  content: {
    padding: spacing.cardPadding,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  halfColumn: {
    flex: 1,
    marginRight: 10,
  },
  halfColumnLast: {
    flex: 1,
    marginRight: 0,
  },
  fullWidthCard: {
    marginTop: 4,
  },
  
  // Aumentar limites de truncagem
  recordText: {
    fontSize: typography.bodySmall,
    // ... truncate(host, 45) em vez de 28
  },
  
  // Subdomains em 2 colunas internas
  subdomainGrid: {
    flexDirection: 'row',
  },
  subdomainColumn: {
    flex: 1,
  },
});
```

#### 3. Aumentar limites de truncagem

| Elemento | Antes | Depois |
|----------|-------|--------|
| NS hostname | 28 chars | 45 chars |
| MX exchange | 28 chars | 45 chars |
| SOA Primary | 22 chars | 35 chars |
| SOA Contact | 22 chars | 35 chars |
| SPF record | 35 chars | 60 chars |
| Subdomain | 26 chars | 38 chars |

#### 4. Subdomínios em 2 colunas (grid interno)

Exibir subdomínios em 2 colunas lado a lado dentro do card, aproveitando a largura total:

```typescript
// Dividir subdomains em 2 colunas
const half = Math.ceil(visibleSubdomains.length / 2);
const col1Subs = visibleSubdomains.slice(0, half);
const col2Subs = visibleSubdomains.slice(half);

<View style={styles.subdomainGrid}>
  <View style={styles.subdomainColumn}>
    {col1Subs.map(...)}
  </View>
  <View style={styles.subdomainColumn}>
    {col2Subs.map(...)}
  </View>
</View>
```

#### 5. Aumentar limite de subdomínios

Com o novo layout, podemos exibir mais subdomínios:

| Elemento | Antes | Depois |
|----------|-------|--------|
| MAX_SUBDOMAINS | 15 | 20 |

---

### Resumo das Alterações

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Layout | 3 colunas estreitas | 2 linhas de 2 cards + 1 card full-width |
| Largura de card | ~33% da página | ~50% da página (ou 100% para subdomains) |
| Truncagem média | 25-30 chars | 40-60 chars |
| Subdomínios visíveis | 15 (1 coluna) | 20 (2 colunas internas) |
| Legibilidade | Comprimido | Espaçoso |

---

### Arquivo Modificado

- `src/components/pdf/sections/PDFDNSMap.tsx`
