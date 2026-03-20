

## Plano: Corrigir erro de sintaxe no script agent-install

### Causa raiz

Linha 19 do `agent-install/index.ts` contém um comentário JavaScript (`//`) dentro do template literal que gera o script bash. Quando o bash recebe o script, interpreta `// Downloads use signed URLs via get_signed_url()` como código e falha em `get_signed_url()` — o `(` é token inesperado.

### Correção

**Arquivo:** `supabase/functions/agent-install/index.ts`

| Linha | Atual | Correção |
|-------|-------|----------|
| 19 | `// Downloads use signed URLs via get_signed_url() — no public storage URL needed` | `# Downloads use signed URLs via get-release-url — no public storage URL needed` |

Apenas converter o comentário de `//` para `#` (sintaxe bash) e remover os parênteses da referência à função.

### Verificação

Após deploy, re-executar o curl de instalação e confirmar que o script é parseado corretamente pelo bash.

