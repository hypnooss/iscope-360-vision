
# Adicionar Barra de Progresso nos Widgets de Top Paises

## Problema

Os widgets de "Top Paises" (tanto Trafego Negado quanto Autenticacao) nao possuem a barra de progresso proporcional que ja existe nos widgets de "Top IPs". Isso cria inconsistencia visual.

## Mudanca

Editar a funcao `CountryListWidget` em `src/pages/firewall/AnalyzerDashboardPage.tsx` para adicionar:

- Calculo de `maxCount` (maior valor entre os paises)
- Numero de ranking (badge numerico como nos IPs)
- Barra de progresso proporcional abaixo de cada entrada
- Mesmo estilo visual usado no `IPListWidget`: barra `h-1 bg-primary/50 rounded-full` sobre fundo `bg-secondary/60`

### Antes (CountryListWidget)
```text
<div className="flex items-center justify-between py-1.5 px-2 ...">
  <CountryName country={c.country} />
  <Badge>{c.count}</Badge>
</div>
```

### Depois
```text
<div className="py-2 px-2 ...">
  <div className="flex items-center gap-3">
    <span className="w-5 h-5 ... rounded bg-secondary">{i+1}</span>
    <div className="flex-1">
      <CountryName country={c.country} />
    </div>
    <Badge>{c.count}</Badge>
  </div>
  <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
    <div className="h-full bg-primary/50 rounded-full" style={{ width: `${(c.count/maxCount)*100}%` }} />
  </div>
</div>
```

### Arquivo a editar
- `src/pages/firewall/AnalyzerDashboardPage.tsx` - Funcao `CountryListWidget` (linhas 79-91)
