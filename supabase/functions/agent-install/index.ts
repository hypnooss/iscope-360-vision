// Public installer script for Linux agents (curl | bash)
// NOTE: keep this endpoint public (verify_jwt = false) and avoid exposing secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROJECT_REF = "akbosdbyheezghieiefz";
const API_BASE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const RELEASE_BASE_URL = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/agent-releases`;

function script(): string {
  // Keep this as a single-file bash script.
  // IMPORTANT: never print activation code in full.
  return `#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL}"
RELEASE_BASE_URL="${RELEASE_BASE_URL}"

ACTIVATION_CODE=""
VERSION="latest"
POLL_INTERVAL="60"

PYTHON_BIN=""

INSTALL_DIR="/opt/iscope-agent"
CONFIG_DIR="/etc/iscope-agent"
STATE_DIR="/var/lib/iscope-agent"

SERVICE_NAME="iscope-agent"
SERVICE_USER="iscope"

UPDATE="0"
UNINSTALL="0"

mask_code() {
  local code="$1"
  if [[ "\${#code}" -le 8 ]]; then
    echo "****"
    return
  fi
  echo "\${code:0:4}-****-****-\${code: -4}"
}

usage() {
  cat <<EOF
Uso:
  sudo bash -s -- --activation-code "XXXX-XXXX-XXXX-XXXX" [opções]

Opções:
  --activation-code   (obrigatório)
  --version           (default: latest)
  --poll-interval     (default: 120)
  --install-dir       (default: /opt/iscope-agent)
  --config-dir        (default: /etc/iscope)
  --state-dir         (default: /var/lib/iscope)
  --update            (reinstala/atualiza)
  --uninstall         (remove serviço e diretórios)
EOF
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Erro: execute como root (use sudo)."
    exit 1
  fi
}

require_systemd() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "Erro: este instalador requer systemd (systemctl não encontrado)."
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --activation-code)
        ACTIVATION_CODE="\${2:-}"; shift 2 ;;
      --version)
        VERSION="\${2:-}"; shift 2 ;;
      --poll-interval)
        POLL_INTERVAL="\${2:-}"; shift 2 ;;
      --install-dir)
        INSTALL_DIR="\${2:-}"; shift 2 ;;
      --config-dir)
        CONFIG_DIR="\${2:-}"; shift 2 ;;
      --state-dir)
        STATE_DIR="\${2:-}"; shift 2 ;;
      --update)
        UPDATE="1"; shift 1 ;;
      --uninstall)
        UNINSTALL="1"; shift 1 ;;
      -h|--help)
        usage; exit 0 ;;
      *)
        echo "Argumento desconhecido: $1"; usage; exit 1 ;;
    esac
  done

  if [[ "$UNINSTALL" -eq 0 ]] && [[ -z "$ACTIVATION_CODE" ]]; then
    echo "Erro: --activation-code é obrigatório."
    exit 1
  fi
}

detect_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "\${ID:-unknown}"
  else
    echo "unknown"
  fi
}

choose_python() {
  local candidates=("python3.11" "python3.10" "python3.9" "python3.8" "python3")
  local c
  for c in "\${candidates[@]}"; do
    if command -v "$c" >/dev/null 2>&1; then
      PYTHON_BIN="$c"
      return 0
    fi
  done
  return 1
}

require_python_min_version() {
  # Require Python >= 3.9
  if [[ -z "\${PYTHON_BIN:-}" ]]; then
    echo "Erro: não consegui localizar Python no sistema."
    echo "Instale python39 e tente novamente. Ex.: sudo dnf install -y python39 python39-pip"
    exit 1
  fi

  local ver
  ver="\$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")' 2>/dev/null || true)"
  local maj min
  maj="\${ver%%.*}"
  min="\${ver#*.}"

  if [[ -z "\${maj:-}" || -z "\${min:-}" ]]; then
    echo "Erro: falha ao detectar versão do Python usando '$PYTHON_BIN'."
    exit 1
  fi

  if [[ "$maj" -lt 3 || ( "$maj" -eq 3 && "$min" -lt 9 ) ]]; then
    echo "Erro: Python >= 3.9 é obrigatório. Detectado: $ver ($PYTHON_BIN)"
    echo "Oracle Linux/RHEL 8: sudo dnf install -y python39 python39-pip"
    exit 1
  fi
}

install_deps() {
  local os_id
  os_id="$(detect_os)"
  echo "Instalando dependências (OS: \${os_id})..."

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y tar curl python3 python3-venv python3-pip build-essential libssl-dev libffi-dev
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    # Instalar dependências básicas
    dnf install -y tar curl gcc openssl-devel libffi-devel || true
    
    # Instalar EPEL para CentOS/RHEL 8 (necessário após EOL)
    dnf install -y epel-release 2>/dev/null || true
    
    # Para CentOS 8 EOL: apontar repos para vault
    if [[ -f /etc/centos-release ]] && grep -q "CentOS.*8" /etc/centos-release 2>/dev/null; then
      sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
      sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
      dnf clean all 2>/dev/null || true
    fi
    
    # Tentar habilitar módulo python39 (se disponível)
    dnf module reset python39 -y 2>/dev/null || true
    dnf module enable python39 -y 2>/dev/null || true
    
    # Instalar Python (múltiplos fallbacks)
    dnf install -y python39 python39-pip python39-devel 2>/dev/null || \\
    dnf install -y python3 python3-pip python3-devel 2>/dev/null || \\
    dnf install -y python38 python38-pip python38-devel 2>/dev/null || true
    
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    yum install -y tar curl gcc openssl-devel libffi-devel || true
    yum install -y python39 python39-pip python39-devel || true
    yum install -y python3 python3-pip python3-devel || true
    return
  fi

  echo "Erro: gerenciador de pacotes não suportado. Instale python3, venv e pip manualmente."
  exit 1
}

install_amass() {
  echo "Instalando Amass para enumeração de subdomínios..."
  
  # Garantir que /usr/local/bin está no PATH
  export PATH="/usr/local/bin:\$PATH"
  
  local arch
  arch="\$(uname -m)"
  case "\$arch" in
    x86_64)  arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *)
      echo "Aviso: arquitetura \$arch não suportada para Amass. Pulando instalação."
      return 0
      ;;
  esac
  
  local version="v4.2.0"
  local filename="amass_Linux_\${arch}.zip"
  local url="https://github.com/owasp-amass/amass/releases/download/\${version}/\${filename}"
  local tmp_dir
  tmp_dir="\$(mktemp -d)"
  
  echo "Baixando Amass \${version} (\${arch})..."
  
  if ! curl -fsSL "\$url" -o "\${tmp_dir}/amass.zip"; then
    echo "Aviso: falha ao baixar Amass. Continuando sem ele."
    rm -rf "\$tmp_dir"
    return 0
  fi
  
  # Instalar unzip se necessário
  if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get install -y unzip || true
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y unzip || true
    elif command -v yum >/dev/null 2>&1; then
      yum install -y unzip || true
    fi
  fi
  
  unzip -q "\${tmp_dir}/amass.zip" -d "\$tmp_dir"
  
  # Buscar binário - primeiro sem -executable (compatibilidade)
  local bin_path
  bin_path="\$(find "\$tmp_dir" -name 'amass' -type f 2>/dev/null | head -1)"
  
  # Fallback: buscar em estrutura conhecida
  if [[ -z "\$bin_path" ]]; then
    bin_path="\$(find "\$tmp_dir" -path '*/amass_Linux_*/amass' -type f 2>/dev/null | head -1)"
  fi
  
  if [[ -n "\$bin_path" ]]; then
    mv "\$bin_path" /usr/local/bin/amass
    chmod +x /usr/local/bin/amass
    
    # Verificar usando caminho absoluto
    if /usr/local/bin/amass -version >/dev/null 2>&1; then
      echo "Amass instalado: \$(/usr/local/bin/amass -version 2>&1 | head -1)"
    else
      echo "Amass instalado em /usr/local/bin/amass"
    fi
  else
    echo "Aviso: binário do Amass não encontrado no pacote."
    echo "Arquivos encontrados:"
    find "\$tmp_dir" -type f 2>/dev/null | head -10
  fi
  
  rm -rf "\$tmp_dir"
}

ensure_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    return
  fi

  if command -v useradd >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER" || true
  else
    echo "Aviso: useradd não encontrado; continuando sem criar usuário dedicado."
  fi
}

ensure_dirs() {
  mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR" "/var/log/iscope-agent"
}

stop_service_if_exists() {
  if systemctl list-unit-files | grep -q "^\${SERVICE_NAME}\\.service"; then
    systemctl stop "$SERVICE_NAME" || true
    systemctl disable "$SERVICE_NAME" || true
  fi
}

uninstall_all() {
  echo "Removendo \${SERVICE_NAME}..."
  stop_service_if_exists
  rm -f "/etc/systemd/system/\${SERVICE_NAME}.service"
  systemctl daemon-reload || true
  rm -rf "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR"
  echo "Uninstall concluído."
}

download_release() {
  local file
  if [[ "$VERSION" == "latest" ]]; then
    file="iscope-agent-latest.tar.gz"
  else
    file="iscope-agent-\${VERSION}.tar.gz"
  fi

  local url
  url="\${RELEASE_BASE_URL}/\${file}"
  echo "Baixando pacote do agent: \${file}"

  # Prefer more explicit curl failures when available.
  local curl_fail_flag
  if curl --help all 2>/dev/null | grep -q "fail-with-body"; then
    curl_fail_flag="--fail-with-body"
  else
    curl_fail_flag="--fail"
  fi

  # Validate existence early (avoid extracting an HTML error page / empty file)
  if ! curl -fsSI "$url" >/dev/null 2>&1; then
    echo ""
    echo "Erro: não encontrei o pacote no Supabase Storage: agent-releases/\${file}"
    echo "URL: \${url}"
    echo ""
    echo "Próximos passos:"
    echo "1) Faça upload do arquivo \${file} no bucket 'agent-releases' (público)"
    echo "2) Teste a URL acima com: curl -I \"\${url}\""
    echo "3) Rode o instalador novamente"
    echo ""
    echo "Storage (dashboard): https://supabase.com/dashboard/project/${PROJECT_REF}/storage/buckets"
    exit 1
  fi

  local tmp
  tmp="$(mktemp)"
  if ! curl -sS "$curl_fail_flag" -L "$url" -o "$tmp"; then
    echo "Erro: falha ao baixar pacote do agent em: \${url}"
    echo "Verifique se o arquivo existe no bucket agent-releases e se o bucket está público."
    echo "Storage (dashboard): https://supabase.com/dashboard/project/${PROJECT_REF}/storage/buckets"
    exit 1
  fi

  if [[ ! -s "$tmp" ]]; then
    echo "Erro: download retornou um arquivo vazio."
    echo "URL: \${url}"
    echo "Storage (dashboard): https://supabase.com/dashboard/project/${PROJECT_REF}/storage/buckets"
    exit 1
  fi

  rm -rf "$INSTALL_DIR"/*
  tar -xzf "$tmp" -C "$INSTALL_DIR"
  rm -f "$tmp"
}

setup_venv() {
  echo "Configurando ambiente Python (venv)..."
  if ! choose_python; then
    echo "Erro: Python não encontrado após instalar dependências."
    echo "Tente: sudo dnf install -y python39 python39-pip"
    exit 1
  fi

  require_python_min_version

  "$PYTHON_BIN" -m venv "$INSTALL_DIR/venv"
  "$INSTALL_DIR/venv/bin/pip" install --upgrade pip

  # Offline bundle support: if wheels/ exists, install without hitting PyPI
  if [[ -d "$INSTALL_DIR/wheels" ]] && compgen -G "$INSTALL_DIR/wheels/*.whl" >/dev/null 2>&1; then
    echo "Instalando dependências (offline wheels bundle)..."
    "$INSTALL_DIR/venv/bin/pip" install --no-index --find-links "$INSTALL_DIR/wheels" -r "$INSTALL_DIR/requirements.txt"
else
  # Use --no-cache-dir to avoid issues with corrupted cached packages (e.g., certifi missing cacert.pem)
  "$INSTALL_DIR/venv/bin/pip" install --no-cache-dir -r "$INSTALL_DIR/requirements.txt"
fi
}

write_env_file() {
  local env_file
  env_file="$CONFIG_DIR/agent.env"

  # Do not echo activation code to stdout
  cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_LOG_FILE=/var/log/iscope-agent/agent.log
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF

  chmod 600 "$env_file"
  
  # Ensure the service user can read the config file
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    chown "$SERVICE_USER":"$SERVICE_USER" "$env_file"
  fi
}

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
    chown -R "$SERVICE_USER":"$SERVICE_USER" "/var/log/iscope-agent" || true
  fi
}

write_systemd_service() {
  local unit_file
  unit_file="/etc/systemd/system/\${SERVICE_NAME}.service"

  cat > "$unit_file" <<EOF
[Unit]
Description=iScope Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=\${CONFIG_DIR}/agent.env
WorkingDirectory=\${INSTALL_DIR}
ExecStart=\${INSTALL_DIR}/venv/bin/python \${INSTALL_DIR}/main.py
Restart=always
RestartSec=5
EOF

  if id "$SERVICE_USER" >/dev/null 2>&1; then
    cat >> "$unit_file" <<EOF
User=\${SERVICE_USER}
Group=\${SERVICE_USER}
EOF
  fi

  cat >> "$unit_file" <<EOF

[Install]
WantedBy=multi-user.target
EOF
}

start_service() {
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
}

main() {
  require_root
  require_systemd
  parse_args "$@"

  if [[ "$UNINSTALL" -eq 1 ]]; then
    uninstall_all
    exit 0
  fi

  echo "Iniciando instalação do Agent (code: $(mask_code "$ACTIVATION_CODE"))"

  if [[ "$UPDATE" -eq 1 ]]; then
    stop_service_if_exists
  fi

  install_deps
  install_amass
  ensure_user
  ensure_dirs
  download_release
  setup_venv
  write_env_file
  ensure_state_file
  write_systemd_service
  start_service

  echo ""
  echo "Instalado com sucesso!"
  echo "Verificar status: systemctl status \${SERVICE_NAME} --no-pager"
  echo "Ver logs:       journalctl -u \${SERVICE_NAME} -f --no-pager"
}

main "$@"
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(script(), {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
});
