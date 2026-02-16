
# Ajustar Stats Cards, Workspace Selector e Status Badges

## 1. Stats Cards no padrao Execucoes (glass-card com icone grande)

Substituir os 4 `StatCard` atuais por 5 cards no padrao exato da tela Execucoes (`TaskExecutionsPage`):

| Card | Icone | Cor | Metrica |
|---|---|---|---|
| Total | Activity | text-primary | Total de dominios |
| Pendentes | Clock | text-yellow-500 | Analises com status `pending` |
| Executando | Loader2 | text-blue-500 | Analises com status `running` |
| Concluidas | CheckCircle2 | text-green-500 | Analises com status `completed` |
| Falhas | XCircle | text-red-500 | Analises com status `failed` |

Estilo: `Card className="glass-card" > CardContent className="p-4" > div flex items-center gap-3 > Icone w-8 h-8 + div(valor 2xl bold + label xs muted)`.

Grid: `grid-cols-2 md:grid-cols-5 gap-4`.

Os stats serao calculados a partir da analise mais recente de cada dominio (campo `status`).

## 2. Remover opcao "Todos os workspaces"

Remover o `SelectItem value="all"` do seletor de workspace. O estado inicial `selectedWorkspaceId` passara a ser o primeiro workspace da lista (ou vazio). Quando nao ha workspace selecionado, nenhum dado sera exibido ate o usuario selecionar um.

## 3. Status Execucao sempre como Badge

Atualmente, quando `completed`, o status mostra texto simples com a data. Mudar para sempre exibir um Badge:

- **Pendente**: Badge amarela `bg-warning/20 text-warning border-warning/30` (ja existe)
- **Executando**: Badge azul com Loader2 animado (ja existe)
- **Concluida**: Badge verde `bg-green-500/20 text-green-400 border-green-500/30` com a data formatada
- **Falha**: Badge vermelha `bg-destructive/20 text-destructive border-destructive/30`

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Imports**: Remover `StatCard`, `TrendingUp`, `Shield`. Adicionar `Activity`, `Clock`, `CheckCircle2`, `XCircle`.

**Stats useMemo**: Recalcular baseado no campo `status` da analise mais recente de cada dominio, contando `pending`, `running`, `completed`, `failed`.

**Workspace selector**: Remover `SelectItem value="all"`. Inicializar `selectedWorkspaceId` como string vazia. Usar `useEffect` para definir o primeiro workspace quando a lista carregar. Filtrar dados apenas quando um workspace estiver selecionado.

**renderStatusBadge**: Alterar o caso `completed` para retornar um Badge verde em vez de texto simples. Adicionar caso `failed` com Badge vermelha.
