
# Corrigir borda branca nas tabelas — aplicar `glass-card` de forma consistente

## Causa Raiz

O tema escuro usa a variável `--border: 220 15% 18%` (cinza-escuro). A classe `glass-card` aplica `border border-border/50`, que com 50% de opacidade sobre o fundo escuro fica quase invisível — o visual correto e intencional do design.

Quando um `<Card>` **não** tem `glass-card`, ele usa o estilo padrão do shadcn que aplica apenas `border-border` (sem `/50`), resultando na borda branca visível na screenshot.

## Arquivos afetados

Todos os `<Card>` que envolvem tabelas e que estão **sem** `glass-card`:

| Arquivo | Linha(s) |
|---|---|
| `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` | 624 |
| `src/pages/external-domain/ExternalDomainListPage.tsx` | 430 |
| `src/pages/AgentsPage.tsx` | 574 |
| `src/pages/AdministratorsPage.tsx` | 464 |
| `src/pages/UsersPage.tsx` | 542 |
| `src/pages/firewall/FirewallListPage.tsx` | 586 |
| `src/pages/admin/SchedulesPage.tsx` | 492 e 625 |
| `src/pages/admin/TemplatesPage.tsx` | 333 |
| `src/pages/admin/SuperAgentsPage.tsx` | 408 |
| `src/pages/ClientsPage.tsx` | 460 |

Já corretos (com `glass-card`): `ExternalDomainReportsPage`, `TaskExecutionsPage`, `M365ExecutionsPage`, `FirewallsPage`, `ReportsPage`.

## Correção

Em todos os arquivos listados, substituir `<Card>` por `<Card className="glass-card">` no wrapper da tabela.

A mudança é pontual e idêntica em todos os arquivos — apenas uma classe CSS adicionada em cada Card de tabela.

## Resultado esperado

Bordas das tabelas ficam sutis (quase invisíveis), consistentes com o design do tema escuro usado em toda a aplicação, igual ao padrão já correto nas páginas `ExternalDomainReportsPage`, `M365ExecutionsPage`, etc.
