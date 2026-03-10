

## Ajustar Mapa do Entra ID Analyzer para ficar idêntico ao Firewall Analyzer

### Problema
O mapa do Entra ID está dentro de um `Card` com header próprio, enquanto o Firewall Analyzer usa um layout diferente: título uppercase externo ("MAPA DE CONEXÕES"), link "Tela cheia" no canto, e mapa compacto (`max-h-[200px]`) sem card wrapper. Além disso, a legenda interna do `AttackMap` exibe itens de firewall (Saída Bloqueada, Falha Auth FW, etc.) que não se aplicam ao Entra ID.

### Alterações

**1. `src/components/firewall/AttackMap.tsx`**
- Adicionar prop opcional `hideLegend?: boolean` à interface
- Quando `hideLegend` for `true`, não renderizar a legenda interna do componente (linhas 311-345)

**2. `src/components/m365/entra-id/EntraIdLoginMap.tsx`**
- Remover o wrapper `Card`/`CardHeader`/`CardContent`
- Adotar o mesmo layout do Firewall Analyzer:
  - Título uppercase: `<h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Mapa de Conexões</h2>`
  - Link "Tela cheia" com ícone `Maximize2` no canto direito
  - Mapa em container `max-h-[200px] overflow-hidden rounded-lg border border-border/50` clicável para fullscreen
- Passar `hideLegend` ao `AttackMap` para suprimir a legenda de firewall
- Manter a legenda simplificada própria (Login com Sucesso / Login com Falha) abaixo do mapa

