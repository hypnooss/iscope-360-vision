
# Plano: Suporte Completo a PowerShell no Agent

## Situacao Atual

### O que ja esta pronto:

| Componente | Status | Descricao |
|------------|--------|-----------|
| `PowerShellExecutor` | OK | Executor completo em `python-agent/agent/executors/powershell.py` |
| `auth.py` | OK | Detecta `pwsh`, certificado, e reporta `m365_powershell` nas capabilities |
| `register-agent` | OK | Recebe `certificate_public_key` e faz upload para Azure automaticamente |
| Geracao de certificado | OK | `generate_m365_certificate()` no script de instalacao |

### O que falta:

| Componente | Status | Problema |
|------------|--------|----------|
| Instalacao do `pwsh` | AUSENTE | Script nao instala PowerShell Core |
| Modulos M365 | AUSENTE | `ExchangeOnlineManagement` e `Microsoft.Graph.Authentication` nao sao instalados |
| Geracao de cert em `--update` | PARCIAL | A funcao existe mas precisa garantir execucao mesmo em update |
| Upload de cert em agents existentes | NAO TRATADO | Agents ja registrados precisam enviar certificado via heartbeat |

---

## Solucao Proposta

### 1. Atualizar Script de Instalacao (`agent-install/index.ts`)

Adicionar nova funcao `install_powershell()` que:
- Detecta a distribuicao Linux
- Instala PowerShell Core 7.x
- Instala os modulos `ExchangeOnlineManagement` e `Microsoft.Graph.Authentication`

```text
Distribuicoes Suportadas:
- Ubuntu/Debian: via Microsoft repo
- RHEL/CentOS/OracleLinux 8+: via Microsoft repo
```

### 2. Garantir Geracao de Certificado em `--update`

A funcao `generate_m365_certificate()` ja existe no script, mas precisa ser garantida:
- Criar certificado se nao existir (ja faz isso)
- Nao sobrescrever se ja existe (ja faz isso)

A chamada ja esta em `main()` na linha 581, entao nenhuma mudanca e necessaria aqui.

### 3. Mecanismo de Upload de Certificado via Heartbeat

Para agents ja registrados que ganharem certificado apos o update:
- Agent detecta que tem certificado mas `azure_certificate_key_id` nao esta no estado
- Agent envia certificado no heartbeat
- Backend (heartbeat) recebe e faz upload para Azure

---

## Alteracoes Detalhadas

### Arquivo 1: `supabase/functions/agent-install/index.ts`

**Adicionar funcao `install_powershell()` (nova)**

```bash
install_powershell() {
  echo "Instalando PowerShell Core..."
  
  local os_id
  os_id="$(detect_os)"
  
  # Pular se pwsh ja estiver instalado
  if command -v pwsh >/dev/null 2>&1; then
    echo "PowerShell ja instalado: $(pwsh --version)"
    install_m365_modules
    return
  fi
  
  case "$os_id" in
    ubuntu|debian)
      # Instalar pre-requisitos
      apt-get install -y wget apt-transport-https software-properties-common
      
      # Registrar Microsoft repo
      source /etc/os-release
      wget -q "https://packages.microsoft.com/config/$ID/$VERSION_ID/packages-microsoft-prod.deb"
      dpkg -i packages-microsoft-prod.deb
      rm packages-microsoft-prod.deb
      apt-get update
      
      # Instalar PowerShell
      apt-get install -y powershell
      ;;
      
    rhel|centos|rocky|almalinux|ol)
      # Registrar Microsoft repo
      curl -sSL https://packages.microsoft.com/config/rhel/8/prod.repo | tee /etc/yum.repos.d/microsoft-prod.repo
      
      # Instalar PowerShell
      dnf install -y powershell || yum install -y powershell
      ;;
      
    *)
      echo "Aviso: Distribuicao $os_id nao suportada para instalacao automatica do PowerShell."
      echo "Instale manualmente: https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux"
      return
      ;;
  esac
  
  if command -v pwsh >/dev/null 2>&1; then
    echo "PowerShell instalado: $(pwsh --version)"
    install_m365_modules
  else
    echo "Aviso: Falha ao instalar PowerShell. Funcionalidades M365 via PowerShell nao estarao disponiveis."
  fi
}
```

**Adicionar funcao `install_m365_modules()` (nova)**

```bash
install_m365_modules() {
  echo "Instalando modulos PowerShell para M365..."
  
  # Instalar modulos globalmente
  pwsh -NoProfile -NonInteractive -Command '
    $ProgressPreference = "SilentlyContinue"
    
    # Configurar PSGallery como trusted
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
    
    # Instalar ExchangeOnlineManagement
    if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
      Write-Host "Instalando ExchangeOnlineManagement..."
      Install-Module -Name ExchangeOnlineManagement -Scope AllUsers -Force -AllowClobber
    } else {
      Write-Host "ExchangeOnlineManagement ja instalado"
    }
    
    # Instalar Microsoft.Graph.Authentication
    if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Authentication)) {
      Write-Host "Instalando Microsoft.Graph.Authentication..."
      Install-Module -Name Microsoft.Graph.Authentication -Scope AllUsers -Force -AllowClobber
    } else {
      Write-Host "Microsoft.Graph.Authentication ja instalado"
    }
    
    Write-Host "Modulos M365 instalados com sucesso!"
  '
}
```

**Atualizar funcao `main()` para incluir PowerShell**

Adicionar chamada `install_powershell` apos `install_amass`:

```bash
main() {
  # ... codigo existente ...
  
  install_deps
  install_amass
  install_powershell   # <-- NOVO
  ensure_user
  ensure_dirs
  generate_m365_certificate
  # ... resto ...
}
```

---

### Arquivo 2: `python-agent/agent/heartbeat.py`

**Adicionar envio de certificado no heartbeat (se ainda nao enviado)**

O agent precisara verificar:
1. Tem certificado local?
2. Certificado ja foi enviado para Azure? (verificar `azure_certificate_key_id` no estado)
3. Se nao, enviar no heartbeat

```python
# Adicionar ao heartbeat
def get_pending_certificate():
    """Check if there's a certificate that needs to be uploaded."""
    from agent.auth import get_certificate_thumbprint, get_certificate_public_key, CERT_FILE
    
    if not CERT_FILE.exists():
        return None
    
    # Ja tem certificado registrado no Azure?
    if self.state.data.get("azure_certificate_key_id"):
        return None
    
    thumbprint = get_certificate_thumbprint()
    public_key = get_certificate_public_key()
    
    if thumbprint and public_key:
        return {
            "certificate_thumbprint": thumbprint,
            "certificate_public_key": public_key
        }
    
    return None
```

---

### Arquivo 3: `supabase/functions/agent-heartbeat/index.ts`

**Adicionar suporte para receber certificado no heartbeat**

Se o heartbeat incluir `certificate_public_key`, fazer upload para Azure:

```typescript
// No body do heartbeat
const { certificate_thumbprint, certificate_public_key, capabilities } = body;

// Se certificado foi enviado e agent nao tem azure_certificate_key_id
if (certificate_public_key && !agent.azure_certificate_key_id) {
  // Disparar upload assíncrono (nao bloquear heartbeat)
  uploadCertificateAsync(agentId, certificate_thumbprint, certificate_public_key);
}
```

---

### Arquivo 4: `python-agent/agent/version.py`

**Atualizar versao do agent**

```python
__version__ = "1.2.0"  # Antes: 1.1.1
```

---

## Fluxo Completo

```text
1. Admin publica nova versao (1.2.0) com PowerShell
   |
   v
2. Agents recebem update_available no heartbeat
   |
   v
3. AutoUpdater baixa e instala nova versao
   |
   v
4. Script de instalacao executa --update:
   - install_powershell() instala pwsh e modulos
   - generate_m365_certificate() cria certificado (se nao existir)
   |
   v
5. Agent reinicia e faz heartbeat
   |
   v
6. Heartbeat envia certificado (se ainda nao enviado)
   |
   v
7. Backend faz upload do certificado para Azure
   |
   v
8. Agent esta pronto para executar PowerShell M365!
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/agent-install/index.ts` | Adicionar `install_powershell()` e `install_m365_modules()` |
| `python-agent/agent/heartbeat.py` | Enviar certificado pendente no heartbeat |
| `supabase/functions/agent-heartbeat/index.ts` | Receber e processar certificado do heartbeat |
| `python-agent/agent/version.py` | Atualizar para 1.2.0 |

---

## Proxima Acao do Usuario

Apos aprovacao e implementacao:

1. Gerar release `iscope-agent-1.2.0.tar.gz` do python-agent
2. Upload para bucket `agent-releases`
3. Em Administracao > Configuracoes > Agents:
   - Definir versao 1.2.0
   - Fazer upload do pacote
4. Aguardar agents receberem update automatico (proximo heartbeat)
5. Verificar na lista de agents que:
   - `agent_version` = 1.2.0
   - `capabilities` inclui `powershell` e `m365_powershell`
   - `certificate_thumbprint` esta preenchido
