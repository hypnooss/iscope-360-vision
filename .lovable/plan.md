

# Plano: Melhorias no PDF de Análise de Domínios Externos

## Resumo das Alterações

Este plano aborda melhorias visuais e funcionais no relatório PDF de Domínios Externos, focando em:
- Correção do header com a grafia correta do produto
- Substituição dos caracteres que geram "&" (bug de encoding)
- Ajustes de espaçamento e layout

---

## 1. Header - Reformulação Completa

### Problema Atual
- O título aparece como "ISCOPE 360" em caixa alta
- O logo não está sendo renderizado corretamente
- Layout centralizado não aproveita bem o espaço horizontal

### Solução Proposta
Criar um header horizontal profissional:

```text
+---------------------------------------------------------------+
|  [LOGO]  iScope 360                    31/01/2026, 17:07:44   |
|          Análise de Domínio Externo                           |
|          plasutil.com.br • PRECISIO                           |
+---------------------------------------------------------------+
```

**Arquivo**: `src/components/pdf/sections/PDFHeader.tsx`

**Alterações técnicas**:
- Remover `toUpperCase()` do título para preservar "iScope 360"
- Ajustar o logo para ter a mesma altura do texto do brand (aproximadamente 28-32px)
- Usar layout em linha com logo à esquerda e data à direita
- Aplicar a fonte em negrito para "iScope 360" com tamanho 20
- Usar a cor teal (#0D9488) para o brand

---

## 2. Correção dos Caracteres "&" nos Cards de Email

### Problema Identificado
Os ícones "✓" e "✗" não são suportados pela fonte Helvetica no @react-pdf/renderer, resultando na renderização como "&".

### Solução
Substituir os caracteres unicode por alternativas seguras:

**Arquivo**: `src/components/pdf/shared/PDFStatusIcon.tsx`

| Antes | Depois |
|-------|--------|
| `'✓'` | `'OK'` ou desenhar um círculo colorido sem texto |
| `'✗'` | `'X'` ou desenhar um círculo colorido sem texto |

**Abordagem recomendada**: Remover o texto dos ícones e usar apenas círculos coloridos:
- Verde para pass
- Vermelho para fail
- Amarelo para warning
- Azul para pending

Isso é mais limpo visualmente e elimina problemas de encoding.

---

## 3. Tabela de Resumo - Coluna "OK" para "Aprovadas"

### Arquivo
`src/components/pdf/sections/PDFCategorySummaryTable.tsx`

### Alteração
Linha 107: Alterar `>OK<` para `>Aprovadas<`

---

## 4. Problemas Encontrados - Aumentar Espaçamento

### Arquivo
`src/components/pdf/sections/PDFIssuesSummary.tsx`

### Alteração
Aumentar o `marginBottom` dos itens de problema de `spacing.tight` (4px) para `spacing.itemGap` (8px) ou mais (12px):

```typescript
// Linha 49-53
issueItem: {
  ...
  marginBottom: 12, // Era spacing.tight (4)
  ...
}
```

---

## 5. Detalhamento por Categoria - Exibir Aprovadas Individualmente

### Problema Atual
As verificações aprovadas estão condensadas em um único card verde com badges inline.

### Solução
Exibir cada verificação aprovada como um card individual com borda verde, similar aos cards de falha, mas com estilo de sucesso.

**Arquivo**: `src/components/pdf/sections/PDFCategorySection.tsx`

**Alterações**:
1. Remover a seção `passedSection` que agrupa todos os checks aprovados
2. Adicionar estilo `checkItemPassed` similar ao `checkItemExpanded` mas com cores de sucesso
3. Renderizar cada check aprovado individualmente com:
   - Borda verde à esquerda (2-3px)
   - Fundo verde claro (successBg)
   - Ícone de status verde
   - Nome do check
   - Descrição (opcional)

### Novo Estilo Proposto

```typescript
checkItemPassed: {
  backgroundColor: colors.successBg,
  borderRadius: radius.md,
  padding: spacing.cardPadding,
  marginBottom: spacing.itemGap,
  borderWidth: 2,
  borderColor: colors.success,
  borderLeftWidth: 3,
},
```

---

## 6. Aplicar Moldura aos Cards de Categoria

### Problema
Os cards de categoria (header) não têm a mesma moldura que os itens.

### Solução
Adicionar borda de 2px nos cards de header de categoria e nos items para criar consistência visual.

**Arquivo**: `src/components/pdf/sections/PDFCategorySection.tsx`

---

## Sequência de Implementação

| Etapa | Arquivo | Modificação |
|-------|---------|-------------|
| 1 | `PDFStatusIcon.tsx` | Remover caracteres unicode, usar círculos coloridos |
| 2 | `PDFHeader.tsx` | Reformular layout, corrigir grafia "iScope 360" |
| 3 | `PDFCategorySummaryTable.tsx` | Alterar "OK" para "Aprovadas" |
| 4 | `PDFIssuesSummary.tsx` | Aumentar espaçamento entre itens |
| 5 | `PDFCategorySection.tsx` | Exibir checks aprovados individualmente, aplicar molduras |

---

## Resultado Visual Esperado

### Header
```text
[LOGO] iScope 360                           31/01/2026
       Análise de Domínio Externo
       plasutil.com.br • Cliente: PRECISIO
───────────────────────────────────────────────────────
```

### Cards de Email Auth (sem "&")
```text
+──────────+  +──────────+  +───────────+
| ● SPF   |  | ● DKIM   |  | ● DMARC   |
| Válido  |  | Ausente  |  | Ativo     |
+──────────+  +──────────+  +───────────+
```

### Problemas Encontrados (com mais espaço)
```text
┌─────────────────────────────────────────────────┐
│ ! Problemas Encontrados                    (6)  │
├─────────────────────────────────────────────────┤
│ ● Diversidade de Nameservers                    │
│   Verifica se há pelo menos 3 nameservers...    │
│                                                 │
│ ● DKIM Configurado                              │
│   Verifica se o domínio possui...               │
│                                                 │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

### Verificações Aprovadas (individuais com moldura)
```text
┌─────────────────────────────────────────────────┐
│ ● DNSSEC Habilitado                             │
│   Verifica se o DNSSEC está ativo no domínio    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ● Redundância de Nameservers                    │
│   Verifica se há pelo menos 2 nameservers       │
└─────────────────────────────────────────────────┘
```

