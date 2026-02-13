

# Correcoes: Dados ao trocar Workspace + Datas truncadas no Sparkline

## Problema 1 - Dados desatualizados ao trocar Workspace

O hook `useDashboardStats` so define `loading = true` na inicializacao (`useState(true)`). Quando o usuario troca de workspace, o `fetchStats` roda novamente mas **nunca reseta `loading` para `true`**, entao:
- O dashboard continua exibindo os dados antigos enquanto a nova query roda
- Se a query demora, o usuario ve dados do workspace anterior como se fossem do novo

**Solucao**: Adicionar `setLoading(true)` no inicio de `fetchStats()` para que o skeleton de carregamento apareca enquanto os novos dados sao buscados.

## Problema 2 - Datas truncadas no eixo X do Sparkline

Na imagem, as datas aparecem como `3/01` e `13/1` em vez de `03/01` e `13/01`. Isso acontece porque a margem lateral do chart (`left: 4, right: 4`) e muito pequena para acomodar o texto completo, e o Recharts corta os labels que ultrapassam a area do SVG.

**Solucao**: Aumentar as margens laterais do `AreaChart` de `4px` para `16px` para dar espaco aos labels das datas.

## Alteracoes

### Arquivo: `src/hooks/useDashboardStats.ts`

Na funcao `fetchStats`, adicionar `setLoading(true)` como primeira linha do `try`:

```typescript
const fetchStats = async () => {
  setLoading(true);  // <-- adicionar esta linha
  try {
    // ... resto do codigo
```

### Arquivo: `src/components/dashboard/ScoreSparkline.tsx`

Ajustar as margens do `AreaChart`:

```typescript
// De:
margin={{ top: 2, right: 4, bottom: 0, left: 4 }}

// Para:
margin={{ top: 2, right: 16, bottom: 0, left: 16 }}
```

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Resetar loading ao iniciar fetch |
| `src/components/dashboard/ScoreSparkline.tsx` | Aumentar margens laterais para datas caberem |

