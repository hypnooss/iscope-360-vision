
Objetivo: corrigir o comportamento do `Ctrl+C` no Terminal Remoto para interromper de fato `tail -f`, e eliminar o estado inconsistente onde o prompt reaparece enquanto ainda há comando em execução.

1) Diagnóstico confirmado (com evidência)
- O comando longo `tail -f` permanece `status='running'` na tabela `agent_commands` (sem `completed_at`).
- Os comandos `__signal__ SIGINT` estão sendo gravados como `failed` com erro `/bin/sh: __signal__: command not found`.
- Os comandos `__probe__ pwd` também falham com `/bin/sh: __probe__: command not found`.
- No frontend, o prompt pode reaparecer mesmo com stream ativo porque `pendingCommandIds` não é sempre reidratado a partir de updates `running` (especialmente após reconexão/refresh).

2) Causa raiz
- No agente Python, o parsing usa `stripped = command_text.strip()`, mas a execução ainda chama `subprocess.Popen(command_text, ...)` em vez de `stripped`.  
  Isso explica o `__probe__` virar comando shell literal.
- Para `__signal__`, há dois problemas práticos:
  - ambiente/versão pode estar sem o trecho de interceptação carregado;
  - mesmo quando houver stream ativo recebido na UI, o frontend pode não manter o estado “pendente” daquele `command_id`, então o prompt reaparece indevidamente.
- No frontend, `Ctrl+C` está duplicado (handler no input + handler no body), podendo enfileirar sinais repetidos.

3) Plano de implementação

Fase A — Robustez no agente (`python-agent/agent/remote_commands.py`)
- Ajustar execução de comando normal para usar `stripped`:
  - log: `Executando: {stripped[:80]}...`
  - `subprocess.Popen(stripped, shell=True, ...)`
- Tornar detecção de sinal mais resiliente:
  - aceitar `stripped.startswith("__signal__")` e parse do tipo de sinal (`SIGINT` por padrão).
  - manter `SIGINT` como principal.
- Evitar corrida de estado do processo ativo:
  - no `finally`, limpar `self._running_proc`/`self._running_cmd_id` apenas se o `command_id` atual ainda for o mesmo ativo.
- Incluir logs explícitos para confirmar path de sinal:
  - “Signal command interceptado”
  - “SIGINT enviado ao PID X”
  - “Nenhum processo ativo para sinal”
- Opcional de segurança operacional:
  - fallback `proc.terminate()` se `send_signal` falhar.

Fase B — Consistência do estado no frontend (`src/components/agents/RemoteTerminal.tsx`)
- Reidratar pendência com base em updates em tempo real:
  - ao receber `cmd.status === "running"`, garantir `cmd.id` em `pendingCommandIds`.
  - ao receber status final (`completed|failed|timeout`), remover `cmd.id`.
- Remover duplicidade do `Ctrl+C`:
  - centralizar envio de sinal em um único caminho (`handleTerminalKeyDown`).
  - adicionar guarda para não enviar múltiplos `__signal__` seguidos enquanto um sinal já está em trânsito (ex.: `signalInFlightRef`).
- Evitar prompt falso durante stream:
  - `hasPending` deve refletir “comando em execução” mesmo após reconexão.
  - manter o prompt oculto enquanto houver qualquer `command_id` em running/pending.
- Melhorar UX do `^C`:
  - renderizar `^C` apenas quando o sinal for realmente enfileirado.

Fase C — Compatibilidade com versão do agente em produção
- Como o erro atual indica execução literal de `__signal__`, incluir no checklist de rollout:
  - confirmar arquivo atualizado no host do agent;
  - reiniciar serviço;
  - validar nos logs que apareceu “Signal command interceptado”.
- Se houver update automático por supervisor/worker, validar que o binário/instalação ativa realmente contém a nova versão de `remote_commands.py`.

4) Detalhes técnicos (para implementação)

Arquivos impactados
- `python-agent/agent/remote_commands.py`
  - trocar `command_text` por `stripped` no bloco de execução Popen;
  - robustecer parse de `__signal__`;
  - proteção de limpeza de `_running_proc`.
- `src/components/agents/RemoteTerminal.tsx`
  - garantir add/remove de `pendingCommandIds` também no fluxo de updates `running`;
  - deduplicar `Ctrl+C` e evitar flood de sinais.

Fluxo esperado após correção
```text
Usuário roda tail -f
  -> agent_commands: pending -> running
  -> UI marca command_id como pending/running e esconde prompt

Usuário pressiona Ctrl+C
  -> UI envia __signal__ SIGINT (uma vez)
  -> Agent intercepta sem shell
  -> Agent envia SIGINT ao processo ativo
  -> Comando original finaliza (failed/completed, tipicamente exit 130)
  -> UI remove command_id pendente
  -> Prompt reaparece
```

5) Plano de validação end-to-end
- Teste 1: `tail -f /var/log/iscope-agent/agent.log`
  - verificar stream contínuo.
- Teste 2: pressionar `Ctrl+C`
  - deve aparecer `^C`;
  - stream deve parar em poucos segundos;
  - prompt deve reaparecer apenas após status final do comando original.
- Teste 3: reconexão com comando já em running
  - não exibir prompt enquanto houver comando running;
  - após finalização, prompt deve aparecer.
- Teste 4: inspeção DB
  - comando `__signal__ SIGINT` não deve mais retornar `command not found`;
  - comando alvo deve sair de `running` para final.
- Teste 5: logs do agent
  - presença de logs de interceptação de sinal e envio de SIGINT.

6) Riscos e mitigação
- Risco: sinal não derrubar processo filho quando `shell=True`.
  - Mitigação: fallback `terminate()` e, se necessário, envio para grupo de processo (evolução futura).
- Risco: múltiplos Ctrl+C em sequência.
  - Mitigação: trava `signalInFlightRef`.
- Risco: divergência entre código do repositório e código efetivamente instalado no host.
  - Mitigação: checklist explícito de rollout + validação por logs/DB.
