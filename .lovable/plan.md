
Objetivo
- Na tela “Domínio Externo > Domínios Externos”:
  1) Trocar os cards (Domínios Ativos / Pendentes / Com problemas) por “Score Médio / Alertas Críticos / Falhas Críticas”, no mesmo padrão visual da tela “Firewall > Firewalls”.
  2) Na tabela, na coluna “Domínio”, parar de exibir o mesmo domínio duas vezes e usar a tipografia padrão (igual às outras colunas).

Contexto atual (como está hoje)
- `ExternalDomainStatsCards.tsx` recebe `{ total, active, pending, issues }` e renderiza 4 cards com ícone Globe.
- `ExternalDomainListPage.tsx` calcula stats de active/pending/issues via `useMemo()` com base em `domains`.
- `ExternalDomainTable.tsx` na coluna Domínio mostra:
  - `domain.name` (font-medium)
  - `domain.domain` (text-xs muted)
  Como hoje `name` está sendo definido como `payload.domain.trim()` no insert, isso vira “duplicado” na prática.

Mudanças planejadas (frontend)

1) Atualizar os cards de estatísticas para o modelo do Firewall
Arquivos:
- `src/components/external-domain/ExternalDomainStatsCards.tsx`
- `src/pages/external-domain/ExternalDomainListPage.tsx`

Ações:
- Alterar a interface de props do componente `ExternalDomainStatsCards` para algo equivalente ao Firewall:
  - `totalDomains: number`
  - `averageScore: number`
  - `criticalAlerts: number` (ex.: score < 50)
  - `criticalFailures: number` (ex.: score < 30)
- Atualizar o layout/estilo do `ExternalDomainStatsCards` para ficar “igual ao FirewallStatsCards”:
  - Cards com ícones equivalentes:
    - Total de Domínios: usar `Globe` (ou manter `Server` se quiser padronizar com Firewall, mas aqui faz sentido `Globe`)
    - Score Médio: `TrendingUp`
    - Alertas Críticos: `AlertTriangle`
    - Falhas Críticas: `Shield`
  - Mesma lógica de cor do score (success/warning/destructive) para o card de Score Médio.
  - Manter grid 4 colunas e `glass-card` como no Firewall.
- Em `ExternalDomainListPage.tsx`, substituir o `useMemo` atual (active/pending/issues) por um `useMemo` novo com as mesmas regras do Firewall:
  - `totalDomains = domains.length`
  - `domainsWithScore = domains.filter(d => d.last_score !== null)`
  - `averageScore = domainsWithScore.length > 0 ? Math.round(sum/len) : 0`
  - `criticalAlerts = domains.filter(d => d.last_score !== null && d.last_score < 50).length`
  - `criticalFailures = domains.filter(d => d.last_score !== null && d.last_score < 30).length`
- Atualizar a chamada do componente:
  - Antes: `<ExternalDomainStatsCards total={...} active={...} pending={...} issues={...} />`
  - Depois: `<ExternalDomainStatsCards totalDomains={...} averageScore={...} criticalAlerts={...} criticalFailures={...} />`

Observações/decisões:
- Mesmo que a tabela não mostre score/status/última verificação, os cards ainda podem usar `last_score` que já vem do `external_domains` no `fetchData()` (o page já seleciona `*`).
- Se quiser exatamente “igual ao Firewall”, podemos copiar literalmente a estrutura do JSX e só trocar `Firewalls` -> `Domínios` e as labels.

2) Corrigir a coluna “Domínio” para não duplicar e usar tipografia padrão
Arquivo:
- `src/components/external-domain/ExternalDomainTable.tsx`

Ações:
- Ajustar o `<TableCell>` da coluna Domínio para mostrar apenas um valor (preferência: `domain.domain`), sem “font-medium” e sem subtítulo em `text-xs`.
  Opções:
  - Opção A (mais simples e “padrão de tabela”): `TableCell>{domain.domain}</TableCell>`
  - Opção B (mantém um leve destaque, mas ainda padrão): `TableCell><span>{domain.domain}</span></TableCell>` (sem classes)
- Manter as demais colunas como estão.

Validação (checklist rápido)
1) Abrir `/scope-external-domain/domains`
2) Conferir cards:
   - Total de Domínios
   - Score Médio (com % e cor variando)
   - Alertas Críticos
   - Falhas Críticas
3) Conferir tabela:
   - Na coluna “Domínio” aparece apenas uma linha e com a mesma fonte/tamanho das outras células.
4) Testar fluxo end-to-end:
   - Adicionar domínio
   - Verificar que os cards atualizam ao recarregar/listar
   - Clicar “Analisar” e confirmar que o botão entra em loading e exibe toast de sucesso/erro como já está implementado

Risco/impacto
- Mudança é somente de UI/props; impacto principal é ajuste de typing e chamadas do componente.
- Se houver lugares adicionais usando `ExternalDomainStatsCards`, precisaremos atualizar também (pelo nome/uso atual, parece ser só nessa página).

Arquivos que serão alterados
- `src/components/external-domain/ExternalDomainStatsCards.tsx`
- `src/pages/external-domain/ExternalDomainListPage.tsx`
- `src/components/external-domain/ExternalDomainTable.tsx`
