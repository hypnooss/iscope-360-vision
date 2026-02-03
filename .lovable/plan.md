

# Plano: Corrigir permissões do arquivo agent.env

## Problema Identificado

O agent falha ao iniciar porque:
1. O arquivo `/etc/iscope/agent.env` é criado com permissões `600` (apenas root pode ler)
2. O agent roda como usuário `iscope`
3. O usuário `iscope` não tem permissão para ler o arquivo de configuração

**Evidência**: Executando manualmente como root funciona, mas via systemd (como usuário iscope) falha.

## Solução Imediata (execute no servidor)

```bash
sudo chown iscope:iscope /etc/iscope/agent.env
sudo systemctl restart iscope-agent
systemctl status iscope-agent --no-pager
```

---

## Solução Permanente

Modificar o script de instalação para definir o proprietário correto do arquivo `agent.env`.

### Arquivo: `supabase/functions/agent-install/index.ts`

**Alteração na função `write_env_file()` (aproximadamente linhas 305-320):**

De:
```bash
write_env_file() {
  local env_file
  env_file="$CONFIG_DIR/agent.env"

  # Do not echo activation code to stdout
  cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_LOG_FILE=/var/log/iscope/agent.log
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF

  chmod 600 "$env_file"
}
```

Para:
```bash
write_env_file() {
  local env_file
  env_file="$CONFIG_DIR/agent.env"

  # Do not echo activation code to stdout
  cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_LOG_FILE=/var/log/iscope/agent.log
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF

  chmod 600 "$env_file"
  
  # Ensure the service user can read the config file
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    chown "$SERVICE_USER":"$SERVICE_USER" "$env_file"
  fi
}
```

---

## Resumo

| Local | Alteração |
|-------|-----------|
| Função `write_env_file()` | Adicionar `chown` para o usuário do serviço após criar o arquivo |

---

## Resultado Esperado

Após a correção:
1. O arquivo `agent.env` será criado com owner `iscope:iscope`
2. O agent conseguirá ler as configurações ao iniciar
3. As permissões `600` são mantidas (apenas o dono pode ler/escrever) - seguro para o activation code

---

## Próximos Passos

1. Execute a **solução imediata** no servidor para resolver o problema agora
2. Aprove este plano para aplicar a **correção permanente** no script de instalação

