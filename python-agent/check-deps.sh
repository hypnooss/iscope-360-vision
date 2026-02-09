#!/usr/bin/env bash
# ============================================================================
# iScope Agent - System Components Pre-Start Check
# ============================================================================
# This script runs as root via ExecStartPre before the agent starts.
# It checks for a flag file and installs missing system components.
#
# Components managed:
# - PowerShell Core 7.x
# - M365 PowerShell Modules (ExchangeOnlineManagement, Microsoft.Graph.Authentication)
# - M365 Certificate (self-signed RSA-2048 for CBA authentication)
# ============================================================================

# Strict mode, but we handle errors internally to avoid blocking agent startup
set -uo pipefail

# Paths
FLAG_FILE="/var/lib/iscope-agent/check_components.flag"
LOG_FILE="/var/log/iscope-agent/components.log"
CERT_DIR="/var/lib/iscope-agent/certs"
STATE_DIR="/var/lib/iscope-agent"
SERVICE_USER="iscope"

# ============================================================================
# Logging
# ============================================================================

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    log "ERROR: $*"
}

# ============================================================================
# Early Exit Check
# ============================================================================

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Check if verification was requested
if [[ ! -f "$FLAG_FILE" ]]; then
    # No flag = no action needed, exit silently
    exit 0
fi

log "=========================================="
log "Verificação de componentes solicitada"
log "=========================================="

# Remove flag immediately to prevent loops
rm -f "$FLAG_FILE" 2>/dev/null || true
log "Flag removida"

# ============================================================================
# OS Detection
# ============================================================================

detect_os() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        echo "${ID:-unknown}"
    else
        echo "unknown"
    fi
}

get_os_version() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        echo "${VERSION_ID%%.*}"
    else
        echo "0"
    fi
}

OS_ID="$(detect_os)"
OS_VERSION="$(get_os_version)"
log "OS detectado: $OS_ID $OS_VERSION"

# ============================================================================
# PowerShell Installation
# ============================================================================

check_powershell() {
    command -v pwsh >/dev/null 2>&1
}

install_powershell_debian() {
    log "Instalando PowerShell no Debian/Ubuntu..."

    apt-get update -y || true
    apt-get install -y wget apt-transport-https software-properties-common || true

    # Get version for repo URL
    # shellcheck disable=SC1091
    . /etc/os-release
    local deb_url="https://packages.microsoft.com/config/${ID}/${VERSION_ID}/packages-microsoft-prod.deb"

    # Fallback for older versions
    if ! wget -q "$deb_url" -O /tmp/packages-microsoft-prod.deb 2>/dev/null; then
        if [[ "$ID" == "ubuntu" ]]; then
            deb_url="https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb"
        else
            deb_url="https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb"
        fi
        wget -q "$deb_url" -O /tmp/packages-microsoft-prod.deb || return 1
    fi

    dpkg -i /tmp/packages-microsoft-prod.deb || true
    rm -f /tmp/packages-microsoft-prod.deb
    apt-get update || true
    apt-get install -y powershell || return 1

    return 0
}

install_powershell_rhel() {
    log "Instalando PowerShell no RHEL/CentOS..."

    local rhel_version="${OS_VERSION:-8}"

    # Register Microsoft repository
    curl -sSL "https://packages.microsoft.com/config/rhel/${rhel_version}/prod.repo" \
        -o /etc/yum.repos.d/microsoft-prod.repo 2>/dev/null || \
    curl -sSL "https://packages.microsoft.com/config/rhel/8/prod.repo" \
        -o /etc/yum.repos.d/microsoft-prod.repo 2>/dev/null || true

    # Install PowerShell
    if command -v dnf >/dev/null 2>&1; then
        dnf install -y powershell || return 1
    else
        yum install -y powershell || return 1
    fi

    return 0
}

install_powershell() {
    if check_powershell; then
        local version
        version="$(pwsh --version 2>&1 | head -1)"
        log "PowerShell OK: $version"
        return 0
    fi

    log "PowerShell ausente. Instalando..."

    case "$OS_ID" in
        ubuntu|debian)
            install_powershell_debian
            ;;
        rhel|centos|rocky|almalinux|ol)
            install_powershell_rhel
            ;;
        *)
            log_error "OS não suportado para instalação automática do PowerShell: $OS_ID"
            return 1
            ;;
    esac

    if check_powershell; then
        log "PowerShell instalado: $(pwsh --version 2>&1 | head -1)"
        return 0
    else
        log_error "Falha ao instalar PowerShell"
        return 1
    fi
}

# ============================================================================
# M365 PowerShell Modules
# ============================================================================

check_m365_modules() {
    if ! check_powershell; then
        # Can't check modules without PowerShell
        return 0
    fi

    pwsh -NoProfile -NonInteractive -Command '
        $eom = Get-Module -ListAvailable -Name ExchangeOnlineManagement -ErrorAction SilentlyContinue
        $mga = Get-Module -ListAvailable -Name Microsoft.Graph.Authentication -ErrorAction SilentlyContinue
        if ($eom -and $mga) { exit 0 } else { exit 1 }
    ' >/dev/null 2>&1
}

install_m365_modules() {
    if ! check_powershell; then
        log "PowerShell não disponível, pulando módulos M365"
        return 0
    fi

    if check_m365_modules; then
        log "Módulos M365 OK"
        return 0
    fi

    log "Instalando módulos M365..."

    pwsh -NoProfile -NonInteractive -Command '
        $ErrorActionPreference = "Continue"
        $ProgressPreference = "SilentlyContinue"

        try {
            Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
        } catch {}

        if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement -ErrorAction SilentlyContinue)) {
            Write-Host "Instalando ExchangeOnlineManagement..."
            try {
                Install-Module -Name ExchangeOnlineManagement -Scope AllUsers -Force -AllowClobber -ErrorAction Stop
                Write-Host "ExchangeOnlineManagement instalado!"
            } catch {
                Write-Host "Aviso: Falha ao instalar ExchangeOnlineManagement: $($_.Exception.Message)"
            }
        }

        if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Authentication -ErrorAction SilentlyContinue)) {
            Write-Host "Instalando Microsoft.Graph.Authentication..."
            try {
                Install-Module -Name Microsoft.Graph.Authentication -Scope AllUsers -Force -AllowClobber -ErrorAction Stop
                Write-Host "Microsoft.Graph.Authentication instalado!"
            } catch {
                Write-Host "Aviso: Falha ao instalar Microsoft.Graph.Authentication: $($_.Exception.Message)"
            }
        }
    ' 2>&1 | while read -r line; do log "  pwsh: $line"; done

    if check_m365_modules; then
        log "Módulos M365 instalados com sucesso"
        return 0
    else
        log_error "Falha ao instalar alguns módulos M365"
        return 1
    fi
}

# ============================================================================
# M365 Certificate
# ============================================================================

check_certificate() {
    [[ -f "$CERT_DIR/m365.crt" ]] && [[ -f "$CERT_DIR/m365.key" ]] && [[ -f "$CERT_DIR/m365.pfx" ]]
}

generate_certificate() {
    if check_certificate; then
        # Check if certificate is still valid (not expiring within 24h)
        if openssl x509 -in "$CERT_DIR/m365.crt" -checkend 86400 >/dev/null 2>&1; then
            log "Certificado M365 OK"
            return 0
        else
            log "Certificado M365 expirando, regenerando..."
        fi
    fi

    # If .crt and .key exist but .pfx is missing, only regenerate PFX
    if [[ -f "$CERT_DIR/m365.crt" ]] && [[ -f "$CERT_DIR/m365.key" ]] && [[ ! -f "$CERT_DIR/m365.pfx" ]]; then
        log "Gerando apenas arquivo PFX a partir do certificado existente..."

        openssl pkcs12 \
            -export \
            -out "$CERT_DIR/m365.pfx" \
            -inkey "$CERT_DIR/m365.key" \
            -in "$CERT_DIR/m365.crt" \
            -passout pass: \
            -legacy 2>/dev/null || \
        openssl pkcs12 \
            -export \
            -out "$CERT_DIR/m365.pfx" \
            -inkey "$CERT_DIR/m365.key" \
            -in "$CERT_DIR/m365.crt" \
            -passout pass: 2>/dev/null

        if [[ -f "$CERT_DIR/m365.pfx" ]]; then
            chmod 600 "$CERT_DIR/m365.pfx"
            if id "$SERVICE_USER" >/dev/null 2>&1; then
                chown "$SERVICE_USER":"$SERVICE_USER" "$CERT_DIR/m365.pfx" || true
            fi
            log "Arquivo PFX regenerado: $CERT_DIR/m365.pfx"
            return 0
        else
            log_error "Falha ao gerar arquivo PFX"
            return 1
        fi
    fi

    log "Gerando certificado M365..."

    # Ensure openssl is available
    if ! command -v openssl >/dev/null 2>&1; then
        log "openssl não encontrado, instalando..."
        if command -v apt-get >/dev/null 2>&1; then
            apt-get install -y openssl || true
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y openssl || true
        elif command -v yum >/dev/null 2>&1; then
            yum install -y openssl || true
        fi
    fi

    if ! command -v openssl >/dev/null 2>&1; then
        log_error "openssl não disponível"
        return 1
    fi

    # Create certificate directory
    mkdir -p "$CERT_DIR"

    # Generate self-signed certificate valid for 1 year (365 days - Azure limit)
    local hostname
    hostname="$(hostname -s 2>/dev/null || echo 'agent')"

    openssl req -x509 \
        -newkey rsa:2048 \
        -keyout "$CERT_DIR/m365.key" \
        -out "$CERT_DIR/m365.crt" \
        -sha256 \
        -days 365 \
        -nodes \
        -subj "/CN=iScope-Agent-${hostname}/O=iScope 360" 2>/dev/null

    if [[ ! -f "$CERT_DIR/m365.crt" ]]; then
        log_error "Falha ao gerar certificado"
        return 1
    fi

    # Set secure permissions
    chmod 600 "$CERT_DIR/m365.key"
    chmod 644 "$CERT_DIR/m365.crt"

    # Generate PFX file (for PowerShell compatibility)
    # Use empty password for simplicity (protected by file permissions)
    openssl pkcs12 \
        -export \
        -out "$CERT_DIR/m365.pfx" \
        -inkey "$CERT_DIR/m365.key" \
        -in "$CERT_DIR/m365.crt" \
        -passout pass: \
        -legacy 2>/dev/null || \
    openssl pkcs12 \
        -export \
        -out "$CERT_DIR/m365.pfx" \
        -inkey "$CERT_DIR/m365.key" \
        -in "$CERT_DIR/m365.crt" \
        -passout pass: 2>/dev/null

    if [[ -f "$CERT_DIR/m365.pfx" ]]; then
        chmod 600 "$CERT_DIR/m365.pfx"
        log "Arquivo PFX gerado para PowerShell"
    else
        log_error "Falha ao gerar arquivo PFX"
        return 1
    fi

    # Calculate and save SHA1 thumbprint (Azure format - clean, no prefix, uppercase)
    local thumbprint
    thumbprint="$(openssl x509 -in "$CERT_DIR/m365.crt" -noout -fingerprint -sha1 2>/dev/null | \
        sed 's/.*=//' | tr -d ':')"

    if [[ -n "$thumbprint" ]]; then
        echo "$thumbprint" > "$CERT_DIR/thumbprint.txt"
        chmod 644 "$CERT_DIR/thumbprint.txt"
        log "Certificado gerado com thumbprint: $thumbprint"
    else
        log_error "Falha ao calcular thumbprint"
        return 1
    fi

    # Fix ownership for service user
    if id "$SERVICE_USER" >/dev/null 2>&1; then
        chown -R "$SERVICE_USER":"$SERVICE_USER" "$CERT_DIR" || true
    fi

    return 0
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    local errors=0

    # Ensure service user home directory exists (needed for PowerShell modules)
    if id "$SERVICE_USER" >/dev/null 2>&1; then
        local user_home
        user_home="$(eval echo ~$SERVICE_USER)"
        if [[ -n "$user_home" ]] && [[ ! -d "$user_home" ]]; then
            mkdir -p "$user_home"
            chown "$SERVICE_USER":"$SERVICE_USER" "$user_home"
            log "Diretório home criado: $user_home"
        fi
    fi

    # Install PowerShell
    if ! install_powershell; then
        ((errors++)) || true
    fi

    # Install M365 modules (only if PowerShell is available)
    if ! install_m365_modules; then
        ((errors++)) || true
    fi

    # Generate certificate
    if ! generate_certificate; then
        ((errors++)) || true
    fi

    log "=========================================="
    if [[ $errors -eq 0 ]]; then
        log "Verificação concluída com sucesso"
    else
        log "Verificação concluída com $errors erro(s)"
    fi
    log "=========================================="

    # Always exit 0 to not block agent startup
    exit 0
}

main
