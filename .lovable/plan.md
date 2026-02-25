

## Bump Agent para v1.3.4

Apenas uma mudança necessária:

| Arquivo | Mudança |
|---------|---------|
| `python-agent/agent/version.py` | `__version__` de `"1.3.3"` → `"1.3.4"` |

Após o bump, você precisará:
1. Gerar o `.tar.gz` e fazer upload para o bucket `agent-releases` como `iscope-agent-1.3.4.tar.gz` e `iscope-agent-latest.tar.gz`
2. Atualizar `agent_latest_version` nas configurações do sistema para `1.3.4`
3. Os supervisores detectarão a nova versão no próximo heartbeat e farão o update automático

