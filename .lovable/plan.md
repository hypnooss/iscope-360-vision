
# Plano: Criar diretório de log durante instalação

## Problema Identificado

O agent está falhando ao iniciar porque:
1. O arquivo de ambiente define `AGENT_LOG_FILE=/var/log/iscope/agent.log`
2. O diretório `/var/log/iscope/` não existe
3. O agent (rodando como usuário `iscope`) não tem permissão para criar diretórios em `/var/log/`

## Solução Imediata (execute no servidor agora)

```bash
sudo mkdir -p /var/log/iscope
sudo chown iscope:iscope /var/log/iscope
sudo systemctl restart iscope-agent
systemctl status iscope-agent --no-pager
```

---

## Solução Permanente

Modificar o script de instalação para criar o diretório de log com as permissões corretas.

### Arquivo: `supabase/functions/agent-install/index.ts`

**Alteração na função `ensure_dirs()` (linha ~339):**

De:
```bash
ensure_dirs() {
  mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR"
}
```

Para:
```bash
ensure_dirs() {
  mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR" "/var/log/iscope"
}
```

---

**Alteração na função `ensure_state_file()` (linhas ~392-400):**

De:
```bash
ensure_state_file() {
  local state_file
  state_file="$STATE_DIR/state.json"
  if [[ ! -f "$state_file" ]]; then
    cat > "$state_file" <<EOF
{}
EOF
  fi

  if id "$SERVICE_USER" >/dev/null 2>&1; then
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$STATE_DIR" || true
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR" || true
  fi
}
```

Para:
```bash
ensure_state_file() {
  local state_file
  state_file="$STATE_DIR/state.json"
  if [[ ! -f "$state_file" ]]; then
    cat > "$state_file" <<EOF
{}
EOF
  fi

  if id "$SERVICE_USER" >/dev/null 2>&1; then
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$STATE_DIR" || true
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR" || true
    chown -R "$SERVICE_USER":"$SERVICE_USER" "/var/log/iscope" || true
  fi
}
```

---

## Resumo

| Local | Alteração |
|-------|-----------|
| Função `ensure_dirs()` | Adicionar criação de `/var/log/iscope` |
| Função `ensure_state_file()` | Adicionar `chown` para `/var/log/iscope` |

---

## Resultado Esperado

Após a correção:
1. Novas instalações criarão automaticamente o diretório `/var/log/iscope`
2. O diretório terá as permissões corretas para o usuário `iscope`
3. O agent conseguirá escrever logs em `/var/log/iscope/agent.log`

---

## Próximos Passos

1. Execute a **solução imediata** no servidor para resolver o problema agora
2. Aprove este plano para aplicar a **correção permanente** no script de instalação
