

## Ajustar Detecção de Malware para usar abas inline (Origens/Alvos)

### Problema
No `ExchangeCategorySheet.tsx`, a categoria `malware` (linha 342) tem um layout especial sem abas — exibe "Top Domínios de Origem" e "Top Usuários Alvos" em cards empilhados. Já `phishing` e `anti_spam` usam abas inline (Origens / Alvos) com o mesmo padrão visual.

### Solução
Remover o bloco condicional `if (cat === 'malware')` (linhas 342-371) dentro de `renderSecurityContent`, permitindo que malware caia no mesmo fluxo de abas que spam e phishing. Ajustar as variáveis de cor (`badgeBg`, `listColor`) para incluir malware com as cores amber já existentes.

### Alterações
**Arquivo**: `src/components/m365/exchange/ExchangeCategorySheet.tsx`

1. Remover o bloco `if (cat === 'malware') { ... return ... }` (linhas 342-371)
2. Atualizar `badgeBg` e `listColor` para incluir o caso `malware`:
   - `badgeBg`: malware → `'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'`
   - `listColor`: malware → `'text-amber-600 dark:text-amber-400'`

Resultado: Malware terá as mesmas abas "Origens" e "Alvos" que Phishing, com a mesma estrutura visual.

