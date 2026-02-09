

# Fix: Garantir Diretório Home do Usuário iscope

## Problema

O instalador cria o usuário `iscope` com `--no-create-home`, e nenhum outro ponto do sistema cria o diretório `/home/iscope/`. A correção atual no `powershell.py` resolve o problema em runtime (ao executar scripts PowerShell), mas o `check-deps.sh` -- que roda como root durante o restart -- não garante a existência desse diretório.

Isso pode causar falhas silenciosas na instalação dos módulos M365 via PowerShell durante a verificação de componentes.

## Solução

Criar o diretório home do usuário `iscope` em dois pontos:

### 1. Instalador (`agent-install/index.ts`)

Na função `create_service_user()`, após o `useradd`, criar o diretório home e atribuir ownership:

```text
# Após useradd
mkdir -p /home/$SERVICE_USER
chown $SERVICE_USER:$SERVICE_USER /home/$SERVICE_USER
```

### 2. check-deps.sh

Adicionar no início da função `main()`, antes de instalar qualquer componente, a verificação e criação do home:

```text
# Ensure service user home directory exists
if id "$SERVICE_USER" >/dev/null 2>&1; then
    local user_home
    user_home="$(eval echo ~$SERVICE_USER)"
    if [[ -n "$user_home" ]] && [[ ! -d "$user_home" ]]; then
        mkdir -p "$user_home"
        chown "$SERVICE_USER":"$SERVICE_USER" "$user_home"
        log "Diretório home criado: $user_home"
    fi
fi
```

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | Criar `/home/iscope` após `useradd` na função `create_service_user()` |
| `python-agent/check-deps.sh` | Verificar e criar home do usuário no início de `main()` |

