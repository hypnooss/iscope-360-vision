
## Problema Identificado

O PDF ainda está renderizando com o layout antigo de 3 colunas, apesar do código atual mostrar a estrutura de linhas. Isso pode indicar que:

1. As edições anteriores não foram salvas corretamente
2. Há um conflito de cache/build
3. O arquivo foi parcialmente editado

### Solução

Reescrever completamente o arquivo `PDFDNSMap.tsx` para garantir que o novo layout de linhas seja aplicado, substituindo totalmente a estrutura de 3 colunas.

---

### Mudanças Necessárias

#### Layout Atual (que deveria funcionar):

```text
Row 1: [  NS (50%)  ] [  SOA (50%)  ]
Row 2: [  MX (50%)  ] [  TXT (50%)  ]
Row 3: [     Subdomínios (100%)     ]
```

#### Código que precisa ser confirmado/reescrito:

1. **Estilos** - Garantir que `row`, `halfColumn`, `halfColumnLast`, `fullWidthCard` estejam definidos corretamente

2. **JSX** - Garantir a estrutura correta:
   - `View style={styles.content}` contendo todas as linhas
   - Linha 1: `View style={styles.row}` com NS e SOA
   - Linha 2: `View style={styles.row}` com MX e TXT
   - Linha 3: `View style={styles.fullWidthCard}` com Subdomínios

3. **Remover qualquer referência** ao layout antigo de 3 colunas (`grid`, `column`, `columnLast`)

---

### Verificações Adicionais

- Confirmar que o export do componente está correto em `sections/index.ts`
- Garantir que não há outro arquivo `PDFDNSMap` sendo usado
- Verificar se o build está sendo atualizado corretamente

---

### Arquivo a Modificar

- `src/components/pdf/sections/PDFDNSMap.tsx` (reescrita completa)
