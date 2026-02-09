
# Bump de Versão: Agent v1.2.8

## Alterações incluídas nesta release

1. **PowerShell Batch Execution** -- Steps PowerShell consecutivos do mesmo módulo são agrupados e executados em uma única sessão (1 Connect-ExchangeOnline em vez de 18), com report progressivo mantido.
2. **Timeout dinâmico** -- Timeout escala com número de comandos: `300 + (N-1) * 30` segundos.
3. **ensure-exchange-permission no fluxo inicial** -- Chamada adicionada antes do Admin Consent para garantir permissões Exchange/SharePoint desde a primeira conexão.

## Alteração técnica

| Arquivo | Mudança |
|---------|---------|
| `python-agent/agent/version.py` | `__version__` para `"1.2.6" |

Apenas o bump de versão. O código funcional já foi implementado nos commits anteriores.
