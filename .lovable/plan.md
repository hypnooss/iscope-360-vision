

## Plano: Execução PowerShell Progressiva (Comando a Comando)

### Problema

Atualmente o agente agrupa todos os 23 comandos Exchange Online em um único script PowerShell, executa tudo de uma vez, e só envia os resultados no final. Se o batch atinge o timeout (960s), **todos os 23 comandos falham** e nenhum dado é salvo.

### Solução: Sessão Interativa com Envio Progressivo

Trocar o `subprocess.run` (batch único) por `subprocess.Popen` (sessão interativa via stdin/stdout). O fluxo passa a ser:

```text
[Agente]                     [PowerShell]              [Backend]
   |── Import module ──────────>|                          |
   |── Connect-ExchangeOnline ─>|                          |
   |                            |                          |
   |── Comando 1 ──────────────>|                          |
   |<── JSON resultado 1 ──────|                          |
   |──────────────────────────────── POST step-result 1 ──>|
   |                            |                          |
   |── Comando 2 ──────────────>|                          |
   |<── JSON resultado 2 ──────|                          |
   |──────────────────────────────── POST step-result 2 ──>|
   |                            |                          |
   |── ...                      |                          |
   |── Disconnect ─────────────>|                          |
   |── exit ───────────────────>|                          |
```

### Vantagens

- **Resiliência**: se o comando 15 falhar por timeout, os 14 anteriores já estão salvos
- **Timeout por comando**: cada comando tem seu próprio timeout (120-300s) em vez de um timeout global
- **Sem risco de perda total**: dados já enviados são preservados
- **Menor uso de memória**: resultados são enviados e descartados um a um

### Arquivos Modificados

**1. `python-agent/agent/executors/powershell.py`**

Adicionar método `run_interactive(steps, context, report_callback)`:
- Inicia `Popen(pwsh, stdin=PIPE, stdout=PIPE, stderr=PIPE)`
- Envia import + connect via stdin
- Para cada comando:
  - Envia o comando wrapped em try/catch com delimitador JSON (`---ISCOPE_CMD_START---` / `---ISCOPE_CMD_END---`)
  - Lê stdout até encontrar o delimitador de fim
  - Aplica timeout individual por comando (do step `params.timeout`, default 120s)
  - Chama `report_callback(step_id, status, data, error, duration)` imediatamente
- Envia disconnect + exit
- Retorna lista de step_results

O método `run()` existente (batch) permanece intacto para compatibilidade com tarefas de comando único (RBAC setup, etc).

**2. `python-agent/agent/tasks.py`**

Alterar `_execute_powershell_batch()`:
- Em vez de chamar `executor.run(merged_step)`, chamar `executor.run_interactive(steps, context, callback)`
- O callback é `self._report_step_result(task_id, ...)` — exatamente o mesmo mecanismo que já existe
- Manter fallback: se `run_interactive` não estiver disponível (ex: versão antiga do executor), usar o batch atual

### Detalhes Técnicos

**Protocolo de Comunicação stdin/stdout:**

Cada comando é enviado ao PowerShell como:
```powershell
try {
  $__data = (Get-AcceptedDomain | ConvertTo-Json -Depth 10 -Compress)
  Write-Output "---ISCOPE_CMD_START---"
  Write-Output (@{ 'name'='exo_accepted_domains'; 'success'=$true; 'data'=$__data } | ConvertTo-Json -Compress)
  Write-Output "---ISCOPE_CMD_END---"
} catch {
  Write-Output "---ISCOPE_CMD_START---"
  Write-Output (@{ 'name'='exo_accepted_domains'; 'success'=$false; 'error'=$_.Exception.Message } | ConvertTo-Json -Compress)
  Write-Output "---ISCOPE_CMD_END---"
}
```

O agente lê stdout linha a linha, acumula entre os delimitadores, e parsea o JSON.

**Timeout individual:**
- Usa `threading.Timer` ou `select` para detectar se um comando excede seu timeout individual
- Se exceder, marca como failed mas **não mata a sessão** — tenta o próximo comando
- Se 3 comandos consecutivos falharem por timeout, aí sim encerra a sessão (proteção contra sessão travada)

**Sem mudanças no backend:**
- O `agent-step-result` já recebe resultados individuais — nenhuma alteração necessária
- O `agent-task-result` continua sendo enviado no final com o resumo

