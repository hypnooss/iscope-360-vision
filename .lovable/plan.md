

# Deploy da Edge Function agent-install

## Diagnóstico

O código no repositório já está correto (SERVICE_NAME="iscope-supervisor", ExecStart com `supervisor.main`, mensagens atualizadas). Porém, a saída do servidor mostra claramente as mensagens antigas:

```
Verificar status: systemctl status iscope-agent --no-pager
```

Quando deveria mostrar:

```
Supervisor instalado com sucesso!
Verificar status: systemctl status iscope-supervisor --no-pager
```

**Causa**: A Edge Function `agent-install` não foi deployada no Supabase após as alterações no código.

## Ação necessária

Fazer deploy das Edge Functions atualizadas:

1. **`agent-install`** — contém a migração para iscope-supervisor
2. **`super-agent-install`** — mesmas alterações para consistência

Após o deploy, re-executar o update no servidor:
```bash
curl -sSL "https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install" | sudo bash -s -- --update
```

A saída deve mostrar "Supervisor instalado com sucesso!" e o serviço `iscope-supervisor` será criado, habilitando heartbeats.

