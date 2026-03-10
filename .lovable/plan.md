

## Problema

A documentação oficial da Microsoft ("Secure by default") confirma que **mensagens de High Confidence Phishing são SEMPRE colocadas em quarentena**, independentemente da configuração da política Anti-Spam. Mesmo que a política mostre "Mover para Junk", a Microsoft faz override automático para Quarentena.

Trecho-chave da documentação:
> "As políticas anti-spam que utilizam a ação 'Mover mensagem para a pasta Email de Lixo' para mensagens de phishing de alta confiança são convertidas na ação 'Mensagem de quarentena'."

Isso significa que nosso diagnóstico atual marca a política como **"Fraco"** com base em uma configuração que, na prática, não tem efeito real — o comportamento efetivo é seguro.

## Plano de Correção

### 1. Backend: `supabase/functions/m365-analyzer/index.ts`

**Opção A (recomendada)**: Ajustar a avaliação do Anti-Spam para não considerar `HighConfidencePhishAction = MoveToJmf` como "weak", já que o Microsoft faz override. Em vez disso, avaliar outras ações como `SpamAction`, `HighConfidenceSpamAction` e `BulkSpamAction` para determinar a robustez real da política.

**Opção B**: Manter a detecção mas rebaixar a severidade, tratando como informacional.

Mudanças concretas (Opção A):
- Linhas ~1302-1308: Alterar a lógica de `hasWeakAction` para verificar `HighConfidenceSpamAction` e `SpamAction` em vez de `HighConfidencePhishAction` (que é override pelo Secure by Default)
- Linhas ~361-372: Remover ou ajustar o insight que alerta sobre `HighConfidencePhishAction` configurado como "MoveToJmf"

### 2. Frontend: `src/components/m365/exchange/ExchangeThreatProtectionSection.tsx`

Atualizar os textos de diagnóstico e recomendação do `antiSpam` para refletir o "Secure by default":

- **`weak` diagnostic**: Explicar que embora a configuração mostre "Mover para Junk", o Microsoft faz override automático para Quarentena em High Confidence Phishing. O risco real está nas demais categorias (Spam, High Confidence Spam) que ainda seguem a ação configurada.
- **`weak` recommendation**: Recomendar ajustar as ações de Spam e High Confidence Spam, mencionando que High Confidence Phishing já está protegido pelo Secure by Default.
- **microsoftUrl**: Adicionar/atualizar com o link `https://learn.microsoft.com/pt-br/defender-office-365/secure-by-default`

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `m365-analyzer/index.ts` | Avaliar Anti-Spam por `SpamAction`/`HighConfidenceSpamAction` em vez de `HighConfidencePhishAction` |
| `ExchangeThreatProtectionSection.tsx` | Atualizar textos de diagnóstico com referência ao Secure by Default |

