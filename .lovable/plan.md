

# Remover serviço legado `iscope-agent` completamente durante instalação/update

## Situação atual

O código já para e desabilita o serviço legado em dois pontos:
- `stop_service_if_exists()` (linhas 611-620 no agent-install, equivalente no super-agent-install)
- `start_service()` (linhas 1183-1195 no agent-install, 849-860 no super-agent-install)

Porém, o **unit file** `/etc/systemd/system/iscope-agent.service` permanece no disco, o que pode causar confusão ou reativação acidental.

## Mudança

Adicionar a remoção do unit file legado em `start_service()` de ambos os installers, logo após parar e desabilitar:

```bash
rm -f "/etc/systemd/system/${LEGACY_SERVICE_NAME}.service"
systemctl daemon-reload
```

## Arquivos afetados

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `supabase/functions/agent-install/index.ts` | 1183-1195 | Adicionar `rm -f` do unit file legado + `daemon-reload` |
| `supabase/functions/super-agent-install/index.ts` | 849-860 | Mesma alteração |

## Detalhe da alteração em `start_service()`

De:
```bash
start_service() {
  systemctl daemon-reload
  if systemctl list-unit-files | grep -q "^${LEGACY_SERVICE_NAME}\.service"; then
    echo "Desabilitando serviço legado ${LEGACY_SERVICE_NAME}..."
    systemctl stop "${LEGACY_SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${LEGACY_SERVICE_NAME}" 2>/dev/null || true
  fi
  systemctl enable --now "$SERVICE_NAME"
}
```

Para:
```bash
start_service() {
  systemctl daemon-reload
  # Remove legacy iscope-agent service completely if it exists
  if systemctl list-unit-files | grep -q "^${LEGACY_SERVICE_NAME}\.service"; then
    echo "Removendo serviço legado ${LEGACY_SERVICE_NAME}..."
    systemctl stop "${LEGACY_SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${LEGACY_SERVICE_NAME}" 2>/dev/null || true
    rm -f "/etc/systemd/system/${LEGACY_SERVICE_NAME}.service"
    systemctl daemon-reload
    echo "Serviço legado removido."
  fi
  systemctl enable --now "$SERVICE_NAME"
}
```

Após aplicar, será necessário fazer deploy das Edge Functions novamente.

