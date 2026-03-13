

## Enriquecer tela lateral "Cobertura MFA"

Aplicar o mesmo padrão visual da sheet "Usuários Ativos": seções com Badge, cards de métricas, barra de progresso e barra proporcional.

### Layout proposto

```text
[Badge: Resumo MFA]
[Total Analisados] [Com MFA] [Sem MFA]
[Progress: Cobertura MFA XX.X%]

[Badge: Distribuição MFA]
[ProportionalBar: Com MFA | Sem MFA]
```

### Alteração

**`src/components/m365/entra-id/EntraIdCategorySheet.tsx`** — substituir o `case 'mfa_coverage'` (linhas 126-137):

- **Seção 1 — Resumo MFA**: Badge + grid 3 colunas (Total Analisados, Com MFA em `text-emerald-500`, Sem MFA em `text-red-500`) + barra `Progress` com percentual de cobertura
- **Seção 2 — Distribuição MFA**: Badge + `ProportionalBar` com 2 segmentos (Com MFA `bg-emerald-500`, Sem MFA `bg-red-500`)

Dados utilizados: `mfa.total`, `mfa.enabled`, `mfa.disabled` (já disponíveis no hook).

