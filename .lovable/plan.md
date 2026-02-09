

# Fix: Mover criacao do home directory e limpeza de cache para ANTES do early exit

## Causa Raiz

No `check-deps.sh` atual, a criacao do diretorio home do usuario `iscope` esta na funcao `main()` (linha ~395), que so roda quando a flag `/var/lib/iscope-agent/check_components.flag` existe. Sem a flag, o script sai na linha 48 e **nunca cria o `/home/iscope`**.

Sem o home directory, o PowerShell retorna string vazia para `$env:HOME`, e o modulo ExchangeOnlineManagement falha com erro `Split-Path`.

## Alteracao

### `python-agent/check-deps.sh` (linhas 43-49)

Mover duas operacoes criticas para **antes** do early exit (entre o `mkdir` do log e o check da flag):

**De:**
```bash
# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Check if verification was requested
if [[ ! -f "$FLAG_FILE" ]]; then
    # No flag = no action needed, exit silently
    exit 0
fi
```

**Para:**
```bash
# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# === ALWAYS RUN (every service start, regardless of flag) ===

# 1. Ensure service user home directory exists (required for PowerShell $env:HOME)
if id "$SERVICE_USER" >/dev/null 2>&1; then
    user_home="$(eval echo ~$SERVICE_USER)"
    if [[ -n "$user_home" ]] && [[ ! -d "$user_home" ]]; then
        mkdir -p "$user_home"
        chown "$SERVICE_USER":"$SERVICE_USER" "$user_home"
    fi
fi

# 2. Clean stale Python bytecode cache (forces recompilation after updates)
INSTALL_DIR="/opt/iscope-agent"
if [[ -d "$INSTALL_DIR" ]]; then
    find "$INSTALL_DIR" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
fi

# === END ALWAYS RUN ===

# Check if verification was requested
if [[ ! -f "$FLAG_FILE" ]]; then
    exit 0
fi
```

A funcao `main()` mantem a mesma logica de home directory como fallback redundante (nao faz mal rodar duas vezes).

## Resultado

- Em **cada inicio** do servico (com ou sem flag), o `/home/iscope` e criado se nao existir
- O `__pycache__` e limpo, forcando recompilacao do `powershell.py` com o preambulo `$env:HOME`
- Erro Split-Path eliminado permanentemente
