

## Adicionar badges "MFA Forte" e "MFA Fraco" ao card Cobertura MFA

### Alteração em `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx`

No caso `mfa_coverage` da função `getCategoryStats` (linhas 70-78), mudar para usar o mesmo padrão de split do card `active_users`, mas com 3 segmentos (forte, fraco, sem MFA):

1. **Calcular strong/weak/disabled** a partir de `mfa.userDetails`:
   - `WEAK_METHODS = ['mobilePhone', 'email']`
   - `strongCount` = usuários com `hasMfa && !allWeak`
   - `weakCount` = usuários com `hasMfa && allWeak`
   - `disabledCount` = `mfa.disabled`

2. **Expandir `CategoryStats`** para suportar um terceiro segmento (`splitC`), ou usar um array de splits.

3. **Atualizar o card** para mostrar:
   - Barra com 3 segmentos: verde (forte), âmbar (fraco), vermelho (sem MFA)
   - Badges: "N MFA Forte" (emerald), "N MFA Fraco" (amber), manter badge "N sem MFA"

### Detalhes da implementação

**`getCategoryStats` — caso `mfa_coverage`:**
- Calcular strong/weak do `userDetails` com a mesma lógica do Sheet
- Retornar splits com 3 segmentos em vez de usar `badgeLabel`

**Interface `CategoryStats`**: Adicionar campo `splits?: Array<{ label: string; value: number; color: string }>` para suportar N segmentos.

**Renderização do card**: Quando `stats.splits` existe, renderizar barra multi-segmento e badges correspondentes (mesmo padrão visual do split A/B existente).

