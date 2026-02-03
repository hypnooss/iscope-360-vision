

## Correção do Mapeamento do Executor Amass

### Problema Identificado
O step `subdomain_enum` no blueprint não está sendo executado pelo `AmassExecutor` porque o mapeamento no `tasks.py` só contém a chave `'amass'`.

Nos logs do agent:
```
Step subdomain_enum: Amass found 0 unique subdomains from 0 sources
```

O step tem `type: subdomain_enum`, mas o executor está mapeado apenas como `'amass'`.

### Solução
Adicionar um alias `'subdomain_enum'` no dicionário `_executors` apontando para a mesma instância do `AmassExecutor`.

### Alteração

**Arquivo:** `python-agent/agent/tasks.py`

**Linha 41-48 - Antes:**
```python
self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
    'dns_query': DNSQueryExecutor(logger),
    'amass': AmassExecutor(logger),
}
```

**Depois:**
```python
self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
    'dns_query': DNSQueryExecutor(logger),
    'amass': AmassExecutor(logger),
    'subdomain_enum': AmassExecutor(logger),  # Alias para blueprints
}
```

### Após Implementação

Você precisará atualizar o arquivo no servidor:

```bash
# 1. Editar o arquivo no servidor
nano /opt/iscope-agent/agent/tasks.py

# 2. Adicionar a linha: 'subdomain_enum': AmassExecutor(logger),

# 3. Limpar cache Python
rm -rf /opt/iscope-agent/agent/__pycache__/

# 4. Reiniciar o Agent
systemctl restart iscope-agent

# 5. Disparar nova análise e verificar logs
journalctl -u iscope-agent -f
```

