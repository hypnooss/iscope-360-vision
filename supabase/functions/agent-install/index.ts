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
POLL_INTERVAL="120"

INSTALL_DIR="/opt/iscope-agent"
CONFIG_DIR="/etc/iscope"
STATE_DIR="/var/lib/iscope"

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

install_deps() {
  local os_id
  os_id="$(detect_os)"
  echo "Instalando dependências (OS: \${os_id})..."

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y python3 python3-venv python3-pip build-essential libssl-dev libffi-dev
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-pip gcc openssl-devel libffi-devel
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    yum install -y python3 python3-pip gcc openssl-devel libffi-devel
    return
  fi

  echo "Erro: gerenciador de pacotes não suportado. Instale python3, venv e pip manualmente."
  exit 1
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
  mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$STATE_DIR"
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

  local tmp
  tmp="$(mktemp)"
  if ! curl -fsSL "$url" -o "$tmp"; then
    echo "Erro: falha ao baixar pacote do agent em: \${url}"
    echo "Verifique se o arquivo existe no bucket agent-releases."
    exit 1
  fi

  rm -rf "$INSTALL_DIR"/*
  tar -xzf "$tmp" -C "$INSTALL_DIR"
  rm -f "$tmp"
}

setup_venv() {
  echo "Configurando ambiente Python (venv)..."
  python3 -m venv "$INSTALL_DIR/venv"
  "$INSTALL_DIR/venv/bin/pip" install --upgrade pip
  "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"
}

write_env_file() {
  local env_file
  env_file="$CONFIG_DIR/agent.env"

  # Do not echo activation code to stdout
  cat > "$env_file" <<EOF
AGENT_API_BASE_URL=\${API_BASE_URL}
AGENT_POLL_INTERVAL=\${POLL_INTERVAL}
AGENT_STATE_FILE=\${STATE_DIR}/state.json
AGENT_ACTIVATION_CODE=\${ACTIVATION_CODE}
EOF

  chmod 600 "$env_file"
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
