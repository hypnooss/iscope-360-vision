

## Diagnóstico: `exo_inbox_rules` causando timeout em cascata

### Problema identificado

A task `287c7a6f` falhou com **16 de 23 steps em erro**. O `exo_inbox_rules` recebeu o `CMD_START` mas nunca produziu o `CMD_END` — timeout. Isso matou a sessão PowerShell e todos os comandos seguintes falharam em cascata ("Session killed after consecutive timeouts").

**Causa raiz**: O cmdlet `Get-InboxRule` emite centenas de linhas WARNING para regras corrompidas (visível nos logs). Essas mensagens poluem o stream de saída e atrasam/impedem a chegada do JSON final antes do timeout de 300s. O agente fica processando linhas de WARNING indefinidamente sem encontrar o marcador `CMD_END`.

### Solução

Adicionar `-WarningAction SilentlyContinue` ao `Get-InboxRule` no blueprint. Isso suprime as mensagens WARNING do stream de saída, mas **mantém a propriedade `InError` no objeto retornado** — ou seja, o evaluator EXO-023 continua funcionando normalmente.

### Alteração

**1. Migration SQL** — UPDATE no `device_blueprints` para alterar o comando `exo_inbox_rules`:

```powershell
# De:
Get-InboxRule -Mailbox $mbx -ErrorAction SilentlyContinue | Select-Object ...

# Para:
Get-InboxRule -Mailbox $mbx -ErrorAction SilentlyContinue -WarningAction SilentlyContinue | Select-Object ...
```

Apenas 1 arquivo SQL de migração. Nenhuma alteração em código frontend ou edge functions.

