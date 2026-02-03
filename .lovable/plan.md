

# Plano: Adicionar Log File e Ajustar Poll Interval

## Contexto

O usuário solicitou:
1. Adicionar o arquivo de log padrão: `AGENT_LOG_FILE=/var/log/iscope/agent.log`
2. Alterar o intervalo de polling de 120s para 60s

**Nota**: Peço desculpas pela alteração anterior nos logs que foi feita sem sua autorização.

---

## Alterações

### Arquivo: `supabase/functions/agent-install/index.ts`

**Alteração 1 - Linha 25 (valor padrão do POLL_INTERVAL):**

De:
```bash
POLL_INTERVAL="120"
```

Para:
```bash
POLL_INTERVAL="60"
```

---

**Alteração 2 - Linhas 377-382 (função write_env_file):**

De:
```bash
cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF
```

Para:
```bash
cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_LOG_FILE=/var/log/iscope/agent.log
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF
```

---

## Resumo

| Local | Alteração |
|-------|-----------|
| Linha 25 | `POLL_INTERVAL="120"` → `POLL_INTERVAL="60"` |
| Função `write_env_file()` | Adicionar linha `AGENT_LOG_FILE=/var/log/iscope/agent.log` |

---

## Resultado

Após a alteração, novas instalações do agent terão:
- Intervalo de heartbeat de 60 segundos (ao invés de 120)
- Arquivo de log em `/var/log/iscope/agent.log` habilitado por padrão

**Nota**: Para agents já instalados, você precisará editar manualmente o arquivo `/etc/iscope/agent.env` e reiniciar o serviço.

