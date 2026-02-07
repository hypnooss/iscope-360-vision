
# Plano: Verificacao de Componentes via ExecStartPre no systemd

## Resumo

Adicionar um script de verificacao de componentes que roda como root **antes** do agent iniciar. Isso permite instalar PowerShell, modulos M365 e gerar certificados sem precisar de sudo no agent principal.

---

## Arquitetura

```text
                    systemd
                       |
                       v
+----------------------------------------------+
| ExecStartPre=/opt/iscope-agent/check-deps.sh |
|            (roda como root)                  |
|                                              |
|  - Verifica flag em /var/lib/iscope-agent/   |
|  - Se flag existe: instala componentes       |
|  - Remove flag apos execucao                 |
+----------------------------------------------+
                       |
                       v
+----------------------------------------------+
| ExecStart=.../venv/bin/python main.py        |
|            (roda como iscope)                |
+----------------------------------------------+
```

---

## Fluxo Completo

```text
1. Admin clica "Verificar Componentes" no modal
   |
   v
2. Frontend UPDATE agents SET check_components = true
   |
   v
3. Agent recebe check_components: true no heartbeat
   |
   v
4. Agent cria arquivo de flag:
   /var/lib/iscope-agent/check_components.flag
   |
   v
5. Agent solicita restart do servico
   |
   v
6. systemd executa ExecStartPre (como root):
   - Detecta flag
   - Instala componentes ausentes
   - Remove flag
   |
   v
7. systemd executa ExecStart (como iscope):
   - Agent inicia normalmente
   - Proximo heartbeat reporta capabilities
```

---

## Implementacao

### 1. Novo Script: `python-agent/check-deps.sh`

Script bash que roda como root antes do agent iniciar:

```bash
#!/usr/bin/env bash
# Script executado como root antes do agent iniciar
# Verifica e instala componentes do sistema quando solicitado

set -euo pipefail

FLAG_FILE="/var/lib/iscope-agent/check_components.flag"
LOG_FILE="/var/log/iscope-agent/components.log"
CERT_DIR="/var/lib/iscope-agent/certs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Verificar se foi solicitada verificacao
if [[ ! -f "$FLAG_FILE" ]]; then
    exit 0
fi

log "Verificacao de componentes solicitada"

# Remover flag imediatamente para evitar loop
rm -f "$FLAG_FILE"

# Detectar OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo "${ID:-unknown}"
    else
        echo "unknown"
    fi
}

# Instalar PowerShell se ausente
install_powershell() {
    if command -v pwsh >/dev/null 2>&1; then
        log "PowerShell OK: $(pwsh --version 2>&1 | head -1)"
        return 0
    fi
    
    log "Instalando PowerShell..."
    # Logica de instalacao por OS...
}

# Instalar modulos M365
install_m365_modules() {
    if ! command -v pwsh >/dev/null 2>&1; then
        return 0
    fi
    
    # Verificar modulos
    if pwsh -NoProfile -Command "..." >/dev/null 2>&1; then
        log "Modulos M365 OK"
        return 0
    fi
    
    log "Instalando modulos M365..."
    # Logica de instalacao...
}

# Gerar certificado se ausente
generate_certificate() {
    if [[ -f "$CERT_DIR/m365.crt" ]] && [[ -f "$CERT_DIR/m365.key" ]]; then
        log "Certificado M365 OK"
        return 0
    fi
    
    log "Gerando certificado M365..."
    # Logica de geracao...
}

# Executar verificacoes
install_powershell
install_m365_modules
generate_certificate

log "Verificacao de componentes concluida"
```

---

### 2. Atualizar systemd unit: `supabase/functions/agent-install/index.ts`

Modificar a funcao `write_systemd_service()` para adicionar ExecStartPre:

```bash
[Service]
Type=simple
EnvironmentFile=${CONFIG_DIR}/agent.env
WorkingDirectory=${INSTALL_DIR}
ExecStartPre=/bin/bash ${INSTALL_DIR}/check-deps.sh
ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/main.py
Restart=always
RestartSec=5
```

**Importante**: O `ExecStartPre` roda como root por padrao (antes do User= ser aplicado).

---

### 3. Atualizar Agent: `python-agent/main.py`

Modificar a logica de `check_components` para criar a flag e solicitar restart:

```python
if result.get('check_components'):
    self.logger.info("Backend solicitou verificacao de componentes")
    
    # Criar flag para o script de pre-inicializacao
    flag_file = Path("/var/lib/iscope-agent/check_components.flag")
    try:
        flag_file.touch()
        self.logger.info("Flag de verificacao criada. Solicitando restart...")
        
        # Solicitar restart do servico
        subprocess.run(
            ['systemctl', 'restart', 'iscope-agent'],
            capture_output=True,
            timeout=30
        )
    except Exception as e:
        self.logger.warning(f"Erro ao criar flag de verificacao: {e}")
```

---

### 4. Atualizar componentes para check-deps.sh

Mover a logica de instalacao de `components.py` para o script bash `check-deps.sh`. O script sera incluido no pacote tar.gz do agent.

---

### 5. Versao: `python-agent/agent/version.py`

```python
__version__ = "1.2.3"
```

---

## Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `python-agent/check-deps.sh` | **NOVO** - Script de verificacao de componentes |
| `python-agent/main.py` | Criar flag e solicitar restart |
| `python-agent/agent/version.py` | Atualizar para 1.2.3 |
| `supabase/functions/agent-install/index.ts` | Adicionar ExecStartPre na unit systemd |

---

## Vantagens da Abordagem

| Aspecto | Descricao |
|---------|-----------|
| **Seguranca** | Agent continua rodando sem privilegios |
| **Confiabilidade** | Script roda em ambiente limpo antes do agent |
| **Simplicidade** | Bash e mais simples para instalacao de pacotes |
| **Retrocompatibilidade** | Agents existentes funcionam apos --update |
| **Logs separados** | Componentes logam em arquivo dedicado |

---

## Consideracoes Importantes

1. **Agents existentes**: Precisam rodar `agent-install --update` para atualizar a unit systemd
2. **Flag file**: Criada pelo agent (usuario iscope), removida pelo script (root)
3. **Timeout**: Script deve ser rapido para nao atrasar o boot do agent
4. **Idempotencia**: Script verifica antes de instalar (nao reinstala se ja existe)

---

## Secao Tecnica

### Permissoes do Flag File

O diretorio `/var/lib/iscope-agent/` tem owner `iscope:iscope`, permitindo que o agent crie arquivos. O script `check-deps.sh` roda como root e pode ler/remover a flag.

### ExecStartPre Behavior

Por padrao, comandos em `ExecStartPre` rodam como root, independente do `User=` definido no servico. Isso e o comportamento padrao do systemd que permite operacoes privilegiadas antes do servico iniciar.

Se um `ExecStartPre` falhar, o servico **nao inicia**. Por isso, o script usa `set -e` mas trata erros internamente para nao bloquear o agent.

### Fallback para Agents Antigos

Agents que ainda nao tem o `check-deps.sh` no pacote continuarao funcionando. O `ExecStartPre` falhara silenciosamente se o script nao existir, mas o agent iniciara normalmente porque usaremos `-` prefix:

```bash
ExecStartPre=-/bin/bash ${INSTALL_DIR}/check-deps.sh
```

O `-` indica ao systemd que falhas neste comando nao impedem o inicio do servico.
