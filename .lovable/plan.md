

## Ajustes no Layout do PDF de Domínio Externo

### Resumo das Alterações

Serão feitas 4 modificações principais para atender às solicitações:

---

### 1. Reorganizar Página 1 (Sumário Executivo)

**Arquivo:** `src/components/pdf/ExternalDomainPDF.tsx`

| Antes (Página 1) | Depois (Página 1) |
|------------------|-------------------|
| Como Ler Este Relatório | Como Ler Este Relatório |
| Postura Geral | Postura Geral |
| Infraestrutura DNS | ~~Removido~~ |
| Resumo por Categoria | ~~Removido~~ |

**Mudanças:**
- Remover `<PDFDomainInfo>` da página 1
- Remover `<PDFCategorySummaryTable>` da página 1
- A página 1 ficará apenas com Header + "Como Ler" + "Postura Geral"

---

### 2. Layout Side-by-Side para NS e SOA (Página 2)

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

```text
ANTES:
┌────────────────────────────────────────────┐
│ [NS Header]                                │
│ [NS Card 1]                                │
│ [NS Card 2]                                │
├────────────────────────────────────────────┤
│ [SOA Header]                               │
│ [SOA Card 1]                               │
│ [SOA Card 2]                               │
└────────────────────────────────────────────┘

DEPOIS:
┌────────────────────┬───────────────────────┐
│ [NS Header]        │ [SOA Header]          │
│ [NS Card 1]        │ [Primary: ...]        │
│ [NS Card 2]        │ [Contact: ...]        │
│                    │ [DNSSEC: ...]         │
└────────────────────┴───────────────────────┘
```

**Implementação:**
- Criar container `flexDirection: 'row'` para NS e SOA
- Cada seção ocupa `width: '48%'` com pequeno espaço entre elas
- Usar `marginRight` para simular gap (react-pdf não suporta gap nativo)

---

### 3. Layout de Duas Colunas para Subdomínios

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

```text
ANTES:
┌────────────────────────────────────────────┐
│ [Subdomínios Header]                       │
│ [subdomain1.domain.com]                    │
│ [subdomain2.domain.com]                    │
│ [subdomain3.domain.com]                    │
│ [subdomain4.domain.com]                    │
└────────────────────────────────────────────┘

DEPOIS:
┌────────────────────────────────────────────┐
│ [Subdomínios Header]                       │
├────────────────────┬───────────────────────┤
│ [subdomain1]       │ [subdomain2]          │
│ [subdomain3]       │ [subdomain4]          │
│ [subdomain5]       │ [subdomain6]          │
└────────────────────┴───────────────────────┘
```

**Implementação:**
- Dividir array de subdomínios ativos em duas colunas (índices pares/ímpares ou split no meio)
- Renderizar em container `flexDirection: 'row'` com duas Views de `width: '48%'`

---

### 4. Remover Tags de Provedores dos Cartões Explicativos

**Arquivo:** `src/components/pdf/sections/PDFExplanatoryCard.tsx`

**Antes (linhas 260-269):**
```tsx
{/* Provider examples */}
{content.providerExamples && content.providerExamples.length > 0 && (
  <View style={styles.providersContainer}>
    {content.providerExamples.map((provider, index) => (
      <View key={index} style={styles.providerTag}>
        <Text style={styles.providerText}>{provider}</Text>
      </View>
    ))}
  </View>
)}
```

**Depois:**
- Remover completamente este bloco de código
- Remover estilos relacionados (`providersContainer`, `providerTag`, `providerText`)

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pdf/ExternalDomainPDF.tsx` | Remover PDFDomainInfo e PDFCategorySummaryTable da página 1 |
| `src/components/pdf/sections/PDFDNSMap.tsx` | Layout side-by-side NS/SOA + subdomínios em 2 colunas |
| `src/components/pdf/sections/PDFExplanatoryCard.tsx` | Remover tags de provedores |

---


### Resultado Visual Esperado
**Página 1:**

- Header (iScope 360 + logo)
- Como Ler Este Relatório (legenda de prioridades)
- Postura Geral (classificação + resumo de verificações)


**Página 2:**

- INFRAESTRUTURA DNS
- AUTENTICAÇÃO DE EMAIL
- Resumo por Categoria

**Página 3 (Mapa DNS):**
- NS (50%) | SOA (50%) - lado a lado
- MX (100% largura)
- TXT (100% largura)
- Subdomínios em 2 colunas

**Páginas 4+ (Guia de Correções):**
- Cartões explicativos sem as tags de provedores no rodapé


