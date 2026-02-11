
# Ajustes nos Cards do Dashboard

## 1. Card Infraestrutura (Print 1)

**Aumentar fonte dos nomes dos modulos**: Trocar `text-sm` para `text-base` nos labels "Firewalls", "Tenants M365", "Dominios" e "Agents".

**Icone para Agents**: Substituir o circulo colorido (`span` com `rounded-full`) pelo icone `Monitor` do Lucide com cor `text-violet-500` (mesma cor do card Infraestrutura). A cor do status (online/offline) sera mantida no indicador do "agentStatusColor" mas movido para um pequeno dot ao lado do numero.

## 2. Module Health Cards (Print 2)

**Remover textos de contagem de ativos**: Remover as linhas "13 firewalls", "5 tenants", "24 dominios" que aparecem abaixo do titulo do modulo no header dos cards.

**Centralizar titulo com icone**: Simplificar o header para que o icone e o titulo fiquem alinhados verticalmente ao centro (`items-center`), removendo o `div` extra com `flex-1 min-w-0` e o paragrafo de contagem.

## Alteracoes tecnicas

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

**Module Health Cards (linhas 65-74)** - Simplificar header:
```tsx
// Antes:
<div className="flex items-center gap-2 w-full">
  <div className={cn('p-2 rounded-lg', iconBg)}>
    <Icon className={cn('w-5 h-5', iconColor)} />
  </div>
  <div className="flex-1 min-w-0">
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
    <p className="text-xs text-muted-foreground">
      {health.assetCount} {assetLabel}
    </p>
  </div>
  <ArrowRight ... />
</div>

// Depois:
<div className="flex items-center gap-2 w-full">
  <div className={cn('p-2 rounded-lg', iconBg)}>
    <Icon className={cn('w-5 h-5', iconColor)} />
  </div>
  <h3 className="font-semibold text-foreground text-sm flex-1">{title}</h3>
  <ArrowRight ... />
</div>
```

**Card Infraestrutura (linhas 354-394)** - Aumentar fonte e adicionar icone Agents:
- Labels: `text-sm` para `text-base`
- Agents: substituir `<span className={cn('w-2.5 h-2.5 rounded-full', agentStatusColor)} />` por `<Monitor className="w-4 h-4 text-violet-500" />`
- Importar `Monitor` do lucide-react

### Resumo

| Alteracao | Detalhe |
|-----------|---------|
| Fonte infra labels | `text-sm` para `text-base` |
| Icone Agents | `Monitor` com `text-violet-500` |
| Header module cards | Remover contagem de ativos, manter titulo inline com icone |
