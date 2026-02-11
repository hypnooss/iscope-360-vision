

# Melhorar exibicao dos ativos no Card Infraestrutura

## Problema atual

Os dados aparecem como "Firewalls 13", "Tenants M365 5" -- o nome do modulo e o numero ficam grudados sem contexto, parecendo informacao jogada na tela.

## Solucao

Mudar o layout de cada ativo de uma linha horizontal para um bloco vertical compacto com 3 niveis:

```text
+------------------+
| [icon] Firewalls |   <- nome do modulo (text-sm, text-muted-foreground)
|      Total       |   <- tag pequena (text-xs, text-muted-foreground, uppercase, tracking-wider)
|       13         |   <- numero grande (text-lg, font-bold, text-foreground)
+------------------+
```

Cada ativo sera um `flex flex-col items-center` com:
1. Linha do icone + nome do modulo (tamanho pequeno, cor muted)
2. Texto "Total" como mini-tag (text-xs, uppercase, tracking-wider, cor muted mais suave)
3. Numero em destaque (text-lg, font-bold)

Para Agents, o numero sera "10/10" com o texto "Online" em vez de "Total".

## Alteracoes tecnicas

### Arquivo: `src/pages/GeneralDashboardPage.tsx` (linhas 353-383)

Substituir o grid atual por:

```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Firewalls */}
  <div className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
    <div className="flex items-center gap-1.5">
      <Shield className="w-4 h-4 text-orange-500" />
      <span className="text-sm text-muted-foreground">Firewalls</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</span>
    <span className="text-lg font-bold text-foreground">{stats?.firewall.assetCount ?? 0}</span>
  </div>

  {/* M365 Tenants */}
  <div className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
    <div className="flex items-center gap-1.5">
      <Cloud className="w-4 h-4 text-blue-500" />
      <span className="text-sm text-muted-foreground">Tenants M365</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</span>
    <span className="text-lg font-bold text-foreground">{stats?.m365.assetCount ?? 0}</span>
  </div>

  {/* Dominios */}
  <div className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
    <div className="flex items-center gap-1.5">
      <Layers className="w-4 h-4 text-green-500" />
      <span className="text-sm text-muted-foreground">Dominios</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</span>
    <span className="text-lg font-bold text-foreground">{stats?.externalDomain.assetCount ?? 0}</span>
  </div>

  {/* Agents */}
  <div className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2.5 h-2.5 rounded-full', agentStatusColor)} />
      <span className="text-sm text-muted-foreground">Agents</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Online</span>
    <span className="text-lg font-bold text-foreground">
      {stats?.agentsOnline ?? 0}/{stats?.agentsTotal ?? 0}
    </span>
  </div>
</div>
```

Cada bloco tera um fundo sutil (`bg-muted/30`) com cantos arredondados para criar uma separacao visual clara entre os ativos, tornando a informacao muito mais legivel.

### Resumo

| Arquivo | Acao |
|---------|------|
| `GeneralDashboardPage.tsx` | Layout vertical com tag "Total"/"Online" nos blocos de ativos |

