

## Diagnóstico

O status `partial` não existe no `statusConfig` da página de Execuções. Quando a Graph API finaliza e o tenant tem agente vinculado, a Edge Function `trigger-m365-posture-analysis` salva o registro com status **`partial`** (aguardando dados do PowerShell). Como `partial` não está mapeado, a linha 605 faz fallback para `statusConfig.pending`:

```
const sConfig = statusConfig[item.status] || statusConfig.pending;
```

Resultado: a row da Edge Function vai de "Executando" → "Pendente" em vez de mostrar um status adequado.

## Correção

**Arquivo: `src/pages/m365/M365ExecutionsPage.tsx`**

Adicionar `partial` ao `statusConfig` com label **"Parcial"** e estilo visual distinto (ex: cor azul-clara/ciano com ícone de loading), indicando que a análise Graph API concluiu mas ainda aguarda dados do agente PowerShell.

```typescript
partial: {
  label: 'Parcial',
  color: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  icon: <Loader2 className="w-3 h-3 animate-spin" />,
},
```

Incluir `partial` na lista de status ativos para manter o polling ativo (linha 226 e 307).

