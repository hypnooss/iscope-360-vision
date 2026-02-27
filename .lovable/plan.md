

## Plano

### 1. Fixar "Detalhes" no rodapé do card

**`src/components/compliance/UnifiedComplianceCard.tsx`**: O link "Detalhes" está dentro do card mas após o conteúdo variável, o que faz ele "flutuar" quando o conteúdo é curto. Solução: usar `flex flex-col` no container principal e `mt-auto` no bloco de "Detalhes" para empurrá-lo ao fundo.

- Adicionar `flex flex-col` ao `div` raiz do card (linha 198)
- Adicionar `flex-1` ao `div` de conteúdo principal (linha 209, `p-4`)
- Adicionar `mt-auto` ao `div` de "Detalhes" (linha 269, `px-4 pb-3`)

### 2. Remover opção "Por Hora" do Domain Compliance

**`src/pages/external-domain/ExternalDomainCompliancePage.tsx`** (linha 636-645): Adicionar `allowHourly={false}` ao `ScheduleDialog`.

### Arquivos editados (2)
- `src/components/compliance/UnifiedComplianceCard.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

