

# Padronizar espaçamentos e ajustar Mapa de Ataques no Firewall Analyzer

## Alterações

### 1. Aumentar espaçamento geral — `AnalyzerDashboardPage.tsx` (linha 501)
- Trocar `space-y-6` por `space-y-10` no container principal

### 2. Trocar `mb-6` por `mb-10` nos wrappers de seção
- Linha 606: Stats Cards `mb-6` → remover (space-y-10 já cuida)
- Linha 613: Category Grid `mb-6` → remover
- Linha 628: Attack Map card `mb-6` → remover

### 3. Card "Mapa de Ataques" — remover título interno, adicionar heading externo
- Remover o `<CardHeader>` inteiro do card (linhas 631-641) que contém "Mapa de Ataques" e o ícone Globe
- Manter apenas o "Tela cheia" como overlay no canto superior direito do card
- Acima do card, adicionar heading com o mesmo estilo das outras seções:
  ```html
  <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
    Mapa de Conexões
  </h2>
  ```

### Arquivos editados
- `src/pages/firewall/AnalyzerDashboardPage.tsx`

