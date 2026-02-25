

# Atualizar Agent para v1.3.2 + Diagnostico OCI-01/OCI-04

## 1. Bump de versao

Alterar `python-agent/agent/version.py` de `"1.3.1"` para `"1.3.2"`.

## 2. Por que OCI-01 e OCI-04 estao em 1.2.10

O mecanismo de auto-update funciona assim:

```text
agent-heartbeat Edge Function
  ├── Le system_settings['agent_latest_version']   (ex: "1.3.1")
  ├── Compara com agent_version reportado pelo agent (ex: "1.2.10")
  ├── Se agent < latest → update_available = true
  └── Envia download_url = storage/agent-releases/iscope-agent-{version}.tar.gz
```

Para os agents se atualizarem, **duas condicoes** precisam existir:

1. **`system_settings.agent_latest_version`** precisa estar configurado com a versao desejada (ex: `"1.3.1"` ou `"1.3.2"`)
2. **O arquivo `iscope-agent-{version}.tar.gz`** precisa existir no bucket `agent-releases`

Se o valor de `agent_latest_version` no banco nao foi atualizado apos o deploy 1.3.1, ou se o pacote `.tar.gz` nao foi carregado no bucket, os agents nunca recebem a instrucao de update — continuam reportando a versao antiga (1.2.10).

**Acoes manuais necessarias (fora do codigo):**
- Gerar o `iscope-agent-1.3.2.tar.gz` com o codigo atualizado e fazer upload ao bucket `agent-releases`
- Atualizar `system_settings` no Supabase: `agent_latest_version` = `"1.3.2"`
- Opcionalmente setar `agent_force_update` = `true` para forcar update mesmo com tarefas pendentes

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `python-agent/agent/version.py` | `__version__` de `"1.3.1"` para `"1.3.2"` |

