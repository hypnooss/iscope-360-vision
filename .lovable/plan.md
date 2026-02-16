

# Padronizar Design das 4 Telas de Dominio Externo

## Resumo das inconsistencias encontradas

| Aspecto | Dominios | Compliance | Analyzer | Execucoes |
|---|---|---|---|---|
| Stats Cards | `Card` sem `glass-card`, icone `w-5` com wrapper `p-2 rounded-lg` | `glass-card`, icone `w-8` direto | `glass-card`, icone `w-5` com wrapper `p-2 rounded-lg bg-muted/50` | `glass-card`, icone `w-8` direto |
| Grid stats | `grid-cols-2 lg:grid-cols-4` | `grid-cols-2 md:grid-cols-5` | `grid-cols-2 lg:grid-cols-4` | `grid-cols-2 md:grid-cols-5` |
| Busca | Input solto | Input solto | Input solto | Dentro de `Card glass-card` |
| Tabela | `Card` sem `glass-card` | `Card` sem `glass-card` | N/A (usa cards) | `Card glass-card` |
| Workspace selector | Dentro do header com `Building2` no trigger | Separado do header com `Building2` fora | Dentro do header com `Building2` no trigger | Nao tem |

## Padrao alvo (baseado em Compliance/Execucoes)

- **Stats Cards**: `Card className="glass-card"` + icone `w-8 h-8` direto (sem wrapper div) + valor `text-2xl font-bold` + label `text-xs text-muted-foreground`
- **Grid stats**: Manter o grid adequado a quantidade de cards de cada pagina
- **Busca**: Input solto (sem card wrapper) - mais limpo e usado em 3 de 4 telas
- **Tabela**: `Card` sem `glass-card` (consistente com maioria)
- **Workspace selector**: Dentro do header, com `Building2` no trigger do `SelectTrigger`

## Mudancas

### 1. ExternalDomainListPage - Stats Cards

Adicionar `className="glass-card"` aos 4 Cards de stats (linhas 418, 431, 444, 457). Remover os wrappers `div p-2 rounded-lg` dos icones e mudar icones de `w-5 h-5` para `w-8 h-8`.

### 2. AttackSurfaceAnalyzerPage - StatCard local

Atualizar a funcao `StatCard` local (linha 496-510) para usar icone `w-8 h-8` direto, sem o wrapper `div p-2 rounded-lg bg-muted/50`.

### 3. ExternalDomainReportsPage - Workspace selector

Mover o icone `Building2` para dentro do `SelectTrigger` (como esta em Dominios e Analyzer), em vez de ficar fora com `flex items-center gap-2`.

### 4. ExternalDomainExecutionsPage - Busca e Tabela

Remover o `Card glass-card` que envolve a area de busca (linhas 584-626), deixando os inputs soltos. Remover `glass-card` do Card da tabela (linha 629).

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/ExternalDomainListPage.tsx`

**Linhas 418-469**: Nos 4 cards de stats, adicionar `glass-card` ao Card e simplificar os icones:
- Remover `<div className="p-2 rounded-lg bg-...">` wrapper
- Mudar icones de `w-5 h-5` para `w-8 h-8`

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Linhas 496-510**: Atualizar StatCard local:
- Remover wrapper `<div className={cn("p-2 rounded-lg bg-muted/50", iconClass)}>`
- Icone direto com `w-8 h-8` e a classe de cor

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Linhas 368-382**: Reestruturar workspace selector para ficar dentro do header `div` com `Building2` dentro do `SelectTrigger`.

### Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`

**Linhas 583-626**: Remover `Card glass-card` wrapper da busca, manter inputs soltos.
**Linha 629**: Remover `glass-card` do Card da tabela.

