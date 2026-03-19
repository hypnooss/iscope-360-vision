#!/bin/bash
# ---------------------------------------------------------------
# iScope 360 Supervisor — Bootstrap / Fallback launcher
#
# This script is the ExecStart for iscope-supervisor.service.
# It tries to boot the Supervisor normally. If the process exits
# with a non-zero code (e.g. broken update), it automatically
# restores the backup and retries ONCE.
#
# This prevents a bad supervisor update from causing an infinite
# crash loop — the previous working version is restored instead.
# ---------------------------------------------------------------

set -euo pipefail

INSTALL_DIR="/opt/iscope-agent"
SUPERVISOR_DIR="${INSTALL_DIR}/supervisor"
BACKUP_DIR="/var/lib/iscope-agent/supervisor_backup"
PYTHON="${INSTALL_DIR}/venv/bin/python"
LOG_TAG="[SupBootstrap]"
ROLLBACK_FLAG="/var/lib/iscope-agent/supervisor_rollback.flag"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_TAG} $*"
}

# --- Attempt 1: Run Supervisor normally ---
log "Iniciando Supervisor (tentativa 1)..."
set +e
"${PYTHON}" -m supervisor.main
EXIT_CODE=$?
set -e

# Exit code 0 = clean shutdown (e.g. restart flag), just exit
if [ ${EXIT_CODE} -eq 0 ]; then
    log "Supervisor encerrou normalmente (exit 0)"
    exit 0
fi

log "Supervisor FALHOU (exit code ${EXIT_CODE})"

# --- Check if backup exists ---
if [ ! -d "${BACKUP_DIR}" ]; then
    log "Sem backup disponível em ${BACKUP_DIR} — não é possível fazer rollback"
    exit ${EXIT_CODE}
fi

# --- Prevent infinite rollback loop ---
if [ -f "${ROLLBACK_FLAG}" ]; then
    log "Rollback flag já existe — rollback anterior também falhou. Abortando."
    rm -f "${ROLLBACK_FLAG}"
    exit ${EXIT_CODE}
fi

# --- Restore backup ---
log "Restaurando backup de ${BACKUP_DIR}..."
rm -rf "${SUPERVISOR_DIR}"
cp -a "${BACKUP_DIR}" "${SUPERVISOR_DIR}"
log "Backup restaurado com sucesso"

# Write rollback flag to prevent infinite loop
echo "$(date -Iseconds)" > "${ROLLBACK_FLAG}"

# --- Attempt 2: Run Supervisor with restored backup ---
log "Iniciando Supervisor (tentativa 2 — versão restaurada)..."
exec "${PYTHON}" -m supervisor.main
