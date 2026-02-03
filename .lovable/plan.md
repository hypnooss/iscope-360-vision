
## Reformular Layout do Mapa DNS no PDF

### Objetivo

Seguir os padrões visuais existentes no PDF para criar um layout mais consistente e limpo.

---

### 1. Título Principal: "Mapa de Infraestrutura DNS"

**Referência:** "Detalhamento por Categoria" (print 2)

Usar estilo de título principal com cor teal:

```text
Mapa de Infraestrutura DNS
```

- Cor: `colors.primary` (#0D9488)
- Fonte: `typography.heading` (16px)
- Font-weight: bold
- Sem fundo escuro, apenas texto colorido

---

### 2. Cards de Categoria: NS, SOA, MX, TXT, Subdomínios

**Referência:** "Segurança DNS" (print 3)

Cada seção terá um header com fundo colorido (mantendo as cores do mapa web):

| Seção | Cor do Header |
|-------|--------------|
| NS | Sky (#0EA5E9) |
| SOA | Amber (#F59E0B) |
| MX | Violet (#A855F7) |
| TXT (Email Auth) | Pink (#EC4899) |
| Subdomínios | Indigo (#6366F1) |

**Layout do header:**
- Fundo sólido colorido
- Texto branco, bold
- **Sem contagem (4/6)** e **sem porcentagem (67%)**

---

### 3. Valores: Estilo "SPF Válido"

**Referência:** Print 4

Cada item dentro do card seguirá o padrão:

```text
● ns1-06.azure-dns.com
● ns2-06.azure-dns.net
```

- Ícone de status (círculo colorido) à esquerda
- Texto do valor à direita
- Card ocupando **largura horizontal total**
- Fundo branco com borda sutil

---

### 4. Estrutura Final

**Layout em coluna única (largura total da página):**

```text
Mapa de Infraestrutura DNS         ← Título teal (sem fundo)

┌─────────────────────────────────────────────────────────────┐
│  NS                                                          │  ← Header Sky
├─────────────────────────────────────────────────────────────┤
│  ● ns1-06.azure-dns.com                                      │
│  ● ns2-06.azure-dns.net                                      │
│  ● ns3-06.azure-dns.org                                      │
│  ● ns4-06.azure-dns.info                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SOA                                                         │  ← Header Amber
├─────────────────────────────────────────────────────────────┤
│  ● Primary: ns1-06.azure-dns.com                             │
│  ● Contact: azuredns-hostmaster@microsoft.com                │
│  ○ DNSSEC: Inativo                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MX                                                          │  ← Header Violet
├─────────────────────────────────────────────────────────────┤
│  ● taschibra-com-br.mail.protection.outlook.com (Pri: 0)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TXT (Email Auth)                                            │  ← Header Pink
├─────────────────────────────────────────────────────────────┤
│  ● SPF: v=spf1 include:spf.protection.outlook.com...         │
│  ● DKIM: selector1 - 2352 bits                               │
│  ● DMARC: p=reject, sp=reject                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Subdomínios                                                 │  ← Header Indigo
├─────────────────────────────────────────────────────────────┤
│  ● chat.taschibra.com.br        ● ns2.taschibra.com.br       │
│  ● drive.taschibra.com.br       ● ns3.taschibra.com.br       │
│  ● ida-fw.taschibra.com.br      ● vpn.taschibra.com.br       │
│  ● mail.taschibra.com.br        ● www.taschibra.com.br       │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Subdomínios: Apenas Ativos

Filtrar subdomínios para exibir apenas os que possuem `is_alive === true`:

```typescript
const activeSubdomains = subdomains.filter(sub => sub.is_alive === true);
```

---

### 6. Remover Elementos

- **Remover:** Seção "Subdomínios Descobertos" separada
- **Remover:** Tabela de subdomínios que aparece depois
- **Manter apenas:** Subdomínios integrados no card "Subdomínios" do mapa

---

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

1. **Título**: Remover header escuro, usar texto teal simples
2. **GroupCard**: Reformular para usar header colorido sem contagem
3. **Valores**: Criar novo componente `InfoItem` com ícone + texto
4. **Layout**: Cards em coluna única (largura total)
5. **Subdomínios**: Filtrar apenas ativos, remover seção separada

**Arquivo:** `src/components/pdf/ExternalDomainPDF.tsx`

1. Remover a página separada de "Subdomínios Descobertos" que contém a tabela

---

### Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Título | Header escuro com ícone | Texto teal simples |
| Cards | Headers com contagem/% | Headers coloridos, só nome |
| Valores | Texto monospace simples | Ícone de status + texto |
| Layout | 2 colunas | 1 coluna (largura total) |
| Subdomínios | Todos + página separada | Apenas ativos, sem página extra |

---

### Arquivos Modificados

- `src/components/pdf/sections/PDFDNSMap.tsx`
- `src/components/pdf/ExternalDomainPDF.tsx`
