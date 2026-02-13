

# Corrigir permissoes do nmap via AmbientCapabilities no systemd

## Problema

O `setcap cap_net_raw+ep` no binario do nmap nao e suficiente. Quando o servico roda como usuario `iscope`, o kernel ignora file capabilities para usuarios nao-root (a menos que o processo tenha a capability no seu "ambient set"). O resultado e que o nmap recusa executar SYN scan com "requires root privileges".

## Solucao

Adicionar `AmbientCapabilities=CAP_NET_RAW` ao unit file do systemd gerado pelo instalador do Super Agent. Isso faz com que o processo do agente (e seus subprocessos como nmap e masscan) herdem a capability `CAP_NET_RAW` automaticamente, sem precisar de root.

## Detalhes tecnicos

### Arquivo: `supabase/functions/super-agent-install/index.ts`

Na funcao `write_systemd_service()` (linha ~780), adicionar `AmbientCapabilities=CAP_NET_RAW` na secao `[Service]`, antes do fechamento do primeiro bloco heredoc:

```
[Service]
Type=simple
EnvironmentFile=${CONFIG_DIR}/agent.env
WorkingDirectory=${INSTALL_DIR}
ExecStartPre=-/bin/bash ${INSTALL_DIR}/check-deps.sh
ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/main.py
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_RAW    # <-- ADICIONAR
```

### Arquivo: `python-agent/check-deps.sh`

Adicionar `setcap cap_net_raw+ep` ao nmap na funcao `install_scanner_tools()` (apos a instalacao do nmap, similar ao que ja fazemos no instalador), para que agentes existentes recebam a correcao via auto-update:

```bash
if command -v nmap >/dev/null 2>&1; then
    log "nmap OK: $(nmap --version 2>&1 | head -1)"
    # Garantir CAP_NET_RAW no binario
    setcap cap_net_raw+ep "$(command -v nmap)" 2>/dev/null || true
fi
```

### Validacao apos aplicar

No servidor, executar:

```bash
systemctl daemon-reload
systemctl restart iscope-agent
su - iscope -s /bin/bash -c "nmap -sS -p 443 8.8.8.8"
```

O scan SYN deve funcionar sem o aviso de "raw socket access".

## Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/super-agent-install/index.ts` | Adicionar `AmbientCapabilities=CAP_NET_RAW` ao unit file do systemd |
| `python-agent/check-deps.sh` | Adicionar `setcap cap_net_raw+ep` ao nmap na funcao de scanner tools |

