
## Ajustar Layout dos Cards de Estatísticas do Firewall Analyzer

### Análise da Diferença Visual

**Firewall Analyzer (atual):**
- Cards verticais com layout `justify-between`
- Ícone à direita
- Texto/label acima do número
- Padding `p-6`

**Surface Analyzer (referência):**
- Cards horizontais com layout `flex items-center gap-3`
- Ícone à esquerda
- Número acima do label
- Padding compacto `p-4`
- Classe `glass-card` para estilo visual

### Mudanças Necessárias

Atualizar `src/components/firewall/AnalyzerStatsCards.tsx`:

1. **Layout**: Mudar de vertical (`justify-between`) para horizontal (`flex items-center gap-3`)
2. **Ordem**: Ícone primeiro, depois texto
3. **Hierarquia do Texto**: Número em cima (`text-2xl`), label embaixo (`text-xs`)
4. **Padding**: Reduzir de `p-6` para `p-4`
5. **Estilo do Card**: Adicionar classe `glass-card` (mantendo `border-border/50`)
6. **Ícone**: Remover background circular, deixar ícone direto com tamanho `w-8 h-8`

### Estrutura Alvo

```tsx
<Card className="glass-card">
  <CardContent className="p-4 flex items-center gap-3">
    <Activity className="w-8 h-8 text-teal-400" />
    <div>
      <p className="text-2xl font-bold">{totalEvents.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">Eventos Totais</p>
    </div>
  </CardContent>
</Card>
```

### Cores dos Ícones (consistência visual)

- **Eventos Totais**: `text-teal-400` (Activity)
- **Taxa de Bloqueio**: `text-red-500` (ShieldAlert)
- **Autenticações**: `text-amber-500` (Shield)
- **Score de Segurança**: `text-green-500` (TrendingUp)

### Arquivo Modificado

- `src/components/firewall/AnalyzerStatsCards.tsx`
