

## Ajustar Layout dos Cards de Insights de Segurança do Exchange Analyzer

### Problema
Os cards de Insights de Segurança do Exchange Analyzer usam um layout com texto descritivo e contagem inline, enquanto o Firewall Analyzer usa cards com **grid de métricas** (label + valor em caixas `bg-secondary/30`).

### Alterações

**Arquivo: `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx`**

Substituir o conteúdo do `CardContent` (linhas 80-95) para usar o mesmo padrão de métricas do Firewall:

1. **Remover** o texto descritivo (`line-clamp-2`) e os spans inline de contagem/usuários afetados.
2. **Adicionar** um grid 2 colunas com caixas de métricas extraídas do insight:
   - Se `count` existir: mostrar "Ocorrências" + valor
   - Se `affectedUsers` existir: mostrar "Usuários Afetados" + length
   - Extrair métricas adicionais do `metadata` quando disponíveis (ex: valores numéricos)
3. **Badge de severidade** permanece no canto superior direito (já está correto).
4. **Ícone** no título permanece (já está correto).

O resultado visual será idêntico ao padrão do Firewall: cards com `border-l-4`, ícone + título no header, badge de severidade, e grid de métricas no body.

### Exemplo do layout alvo (por card)
```text
┌─────────────────────────────────────────┐
│ 🔶 Envio Anômalo Detectado    [Crítico] │
│                                         │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ Ocorrências  │ │ Usuários     │      │
│  │ 5            │ │ 3            │      │
│  └──────────────┘ └──────────────┘      │
└─────────────────────────────────────────┘
```

