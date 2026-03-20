

## Plano: Escala dinâmica (GB/MB) nos eixos Y de Disco e RAM

### Problema
Os gráficos de Disco exibem sempre "GB" e o de RAM exibe valores em MB sem unidade clara. Se o Total for pequeno (ex: 500 MB), mostrar "0.5 GB" é confuso — deveria mostrar "500 MB".

### Solução
Criar uma função utilitária `formatStorageValue(value, totalReference)` que decide a unidade com base no valor total:
- **Disco**: se `totalGb < 1` → converter para MB e exibir "X MB"; senão "X GB"
- **RAM**: se `ramTotal < 1024` → exibir "X MB"; senão converter para GB e exibir "X.X GB"

### Mudanças em `AgentMonitorPanel.tsx`

1. **Adicionar helper no topo do arquivo**:
```ts
function storageTickFormatter(valueMb: number, totalMb: number): string {
  if (totalMb >= 1024) return `${(valueMb / 1024).toFixed(1)} GB`;
  return `${Math.round(valueMb)} MB`;
}
```

2. **RAM (linha 464-468)**: Usar `tickFormatter={(v) => storageTickFormatter(v, ramTotal || 0)}` — valores já estão em MB

3. **Disco — partições (linha 504)**: Os valores estão em GB. Se `totalGb < 1`, converter o tickFormatter para mostrar MB (`v * 1024`), senão mostrar GB:
```ts
tickFormatter={(v) => totalGb && totalGb < 1 ? `${(v * 1024).toFixed(0)} MB` : `${v} GB`}
```

4. **Disco — legado (linha 528)**: Mesma lógica, calcular o `diskTotalMax` e usar para decidir unidade

5. **Labels dos títulos**: Atualizar "RAM (MB)" para dinâmico — "RAM (GB)" ou "RAM (MB)" conforme o total

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Helper de formatação + tickFormatter dinâmico em 3 YAxis + label dinâmico RAM |

