

## Fix: Empty state do Firewall Compliance com estilo Warning

### Problema
O card de "Nenhuma análise encontrada" no Firewall Compliance usa `glass-card` com ícone cinza neutro, mas o padrão definido nos analisadores M365 usa estilo **warning** (borda amber, fundo amber, ícone amber/warning).

### Mudança

Em `src/pages/firewall/FirewallCompliancePage.tsx` (linhas 548-558), trocar:

- `Card className="glass-card"` → `Card className="border-warning/30 bg-warning/5"`
- `Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4"` → `AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3"`
- Ajustar padding e tamanhos de texto para alinhar com o padrão Exchange (`py-10`, `text-base`, `text-sm`, `mb-5`, `max-w-md mx-auto`)
- Adicionar import de `AlertTriangle` (lucide-react)

Resultado final seguirá exatamente o padrão visual do print 1 (Exchange Analyzer warning card).

### Arquivo
- `src/pages/firewall/FirewallCompliancePage.tsx`

