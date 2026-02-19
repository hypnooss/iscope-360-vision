
# Reposicionar a Barra de Progresso no Analyzer Dashboard

## Situação Atual

O layout atual do cabeçalho do Analyzer Dashboard segue esta ordem:

1. `PageBreadcrumb` — Firewall > Analyzer
2. **Linha do título** — "Analyzer" + subtítulo + seletores + botão de executar
3. **Linha de última coleta** — Ícone de relógio + badges de data/período
4. **Progress card** (Card com borda, spinner, barra de progresso) ← posição atual

## Mudança Solicitada

Mover o **Progress card** para entre o subtítulo e a linha de última coleta:

1. `PageBreadcrumb`
2. **Linha do título** — "Analyzer" + subtítulo + seletores + botão
3. **Progress card** ← nova posição (apenas quando `isRunning && progress`)
4. **Linha de última coleta** — badges de data/período

## Detalhe Técnico

O bloco do Progress card (linhas 577–609) será **removido** de sua posição atual e **inserido** logo após o bloco do cabeçalho (`</div>` da linha 549) e antes do bloco de "Last analysis info" (linha 551).

Visualmente, quando uma análise está em andamento, o resultado será:

```text
[Analyzer]          [MOVECTA ▼] [OCI-FW ▼] [⟳ Em andamento...]  [⚙]
 Inteligência de segurança baseada em logs
─────────────────────────────────────────────────────────────────────
  ⟳ Análise em andamento...     Aguardando agent... · 7s   ↻ Atualizar
  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
⏱ Última coleta: 19/02/2026, 14:00   Período agregado: ...   8 coletas
```

## Arquivo a Modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Mover o bloco do Progress card (linhas 577–609) para entre o cabeçalho (linha 549) e o "Last analysis info" (linha 551) |

Apenas reposicionamento de JSX — sem nenhuma alteração de lógica, dados ou estilos.
