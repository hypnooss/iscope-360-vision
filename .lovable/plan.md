

## Diagnóstico: Agent em loop de registro

### Causa Raiz

O fluxo é:
1. Worker inicia, faz POST `/register-agent` com activation_code
2. Backend encontra o agent, gera tokens, **limpa activation_code** (linha 344: `activation_code: null`)
3. Worker recebe resposta, salva state, mas o processo crasha/é reiniciado pelo systemd ANTES de salvar ou ANTES do próximo ciclo
4. Systemd reinicia o Worker (~15s)
5. Worker carrega state.json → `agent_id` é null (state não foi salvo a tempo)
6. Tenta registrar novamente com o MESMO `activation_code`
7. Backend faz `SELECT * FROM agents WHERE activation_code = X` → não encontra (foi limpo no passo 2)
8. Retorna 400 `INVALID_CODE`
9. Agent recebe RuntimeError("INVALID_CODE") que não é tratada → crash → loop infinito

O problema: o backend limpa o `activation_code` imediatamente na primeira chamada, mas o agent pode não ter salvo o state a tempo. Nas chamadas seguintes, o agent não consegue mais se encontrar.

### Correção

**Arquivo: `supabase/functions/register-agent/index.ts`**

1. **Não limpar activation_code no registro** — manter o código para permitir retentativas
2. **Limpar activation_code apenas no primeiro heartbeat bem-sucedido** — quando o agent confirma que está operacional

Mudanças específicas:

**register-agent/index.ts (linha 344):** Remover `activation_code: null` e `activation_code_expires_at: null` do updateData

**agent-heartbeat/index.ts:** Após o heartbeat bem-sucedido, adicionar lógica para limpar `activation_code` se ainda existir:
```
UPDATE agents SET activation_code = NULL, activation_code_expires_at = NULL
WHERE id = p_agent_id AND activation_code IS NOT NULL
```

### Resultado

- Agent pode retentar registro quantas vezes precisar (reemissão de tokens na linha 306)
- Activation_code só é consumido após o agent confirmar que está rodando (heartbeat)
- Sem risco de loop infinito

