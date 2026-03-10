

## Problema

O botão "Tela cheia" está posicionado com `absolute top-3 right-3` dentro do `Card`, mas como está sobre a área do mapa (que tem `overflow-hidden` e `max-h-[200px]`), ele fica coberto/dentro do mapa visualmente.

## Solução

Mover "Tela cheia" para fora do card, posicionando-o ao lado do heading "MAPA DE CONEXÕES" na mesma linha, alinhado à direita. Isso mantém a consistência e garante visibilidade.

### Alteração em `AnalyzerDashboardPage.tsx` (linhas 651-659)

Trocar o heading + absolute overlay por uma linha flex com o título à esquerda e "Tela cheia" à direita:

```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
    Mapa de Conexões
  </h2>
  <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors cursor-pointer">
    <Maximize2 className="w-3.5 h-3.5" />
    Tela cheia
  </div>
</div>
```

E remover o `div absolute` de dentro do Card (linha 656-659).

### Arquivo editado
- `src/pages/firewall/AnalyzerDashboardPage.tsx`

