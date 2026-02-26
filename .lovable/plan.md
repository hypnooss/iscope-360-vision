

## Adicionar indicador de Auto Refresh no Status dos Agents e Supervisors

### Contexto

O `setInterval` de 5s já existe (linhas 98-102), mas visualmente não há nenhuma indicação disso. O botão de refresh manual foi removido sem substituição visual. O utilizador quer ver que o auto-refresh está ativo.

### Mudanças em `src/pages/admin/SettingsPage.tsx`

**1. Título "Status dos Agents" (linha 831):**
Substituir o `<h4>` simples por um flex container com o título + indicador visual de auto-refresh:

```tsx
<div className="flex items-center justify-between">
  <h4 className="font-medium">Status dos Agents</h4>
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
    Auto refresh
  </div>
</div>
```

**2. Título "Status dos Supervisors" (mesma mudança no bloco equivalente ~linha 975):**
Mesmo indicador visual de auto-refresh.

### Resultado

Um pequeno dot verde pulsante com o texto "Auto refresh" aparece no canto superior direito de cada card de status, indicando que os dados se atualizam automaticamente a cada 5 segundos.

