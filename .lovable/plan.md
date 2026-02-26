

## Diagnostico

O evidence e claro. A saida do `--update` mostra:

```
Serviços iniciados: iscope-supervisor e iscope-agent
```

Mas **NAO** mostra "Parando serviço iscope-supervisor..." nem "Parando serviço iscope-agent...", o que significa que `stop_service_if_exists` falhou silenciosamente (o grep nao matchou) ou nao parou o processo de fato.

Resultado:
- O Supervisor VELHO (PID 2708036, 22:21) continua rodando com o **codigo antigo em memoria** — que usa `subprocess.Popen` para spawnar o Worker
- O `systemctl start iscope-supervisor` na `start_service()` e NO-OP porque o servico ja esta "active"
- O novo `iscope-agent.service` iniciou corretamente (PID 2709626), mas agora temos **2 Workers**: um como subprocess do supervisor velho + um como servico independente
- `supervisor.log` nao existe porque o supervisor rodando usa o logger antigo (em memoria)

### Causa raiz

```javascript
// start_service() — linha 1287
systemctl start "$SERVICE_NAME"      // NO-OP se ja esta rodando!
systemctl start "$LEGACY_SERVICE_NAME"
```

Deveria ser `restart`, nao `start`.

## Plano

### 1. Corrigir `start_service()` — usar `restart` em vez de `start`

**Arquivo:** `supabase/functions/agent-install/index.ts`

```bash
start_service() {
  systemctl daemon-reload

  # Stop both services first to ensure clean state
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl stop "$LEGACY_SERVICE_NAME" 2>/dev/null || true

  # Enable and start both services
  systemctl enable "$SERVICE_NAME" "$LEGACY_SERVICE_NAME"
  systemctl start "$LEGACY_SERVICE_NAME"
  systemctl start "$SERVICE_NAME"

  echo "Serviços iniciados: $SERVICE_NAME e $LEGACY_SERVICE_NAME"
}
```

### 2. Corrigir `stop_service_if_exists()` — tornar mais robusto

Remover o grep condicional fragil e simplesmente parar:

```bash
stop_service_if_exists() {
  for svc in "$SERVICE_NAME" "$LEGACY_SERVICE_NAME"; do
    echo "Parando serviço ${svc}..."
    systemctl stop "$svc" 2>/dev/null || true
    systemctl disable "$svc" 2>/dev/null || true
  done
}
```

### 3. Mesmas correcoes em `super-agent-install`

Aplicar as mesmas mudancas em `supabase/functions/super-agent-install/index.ts`.

### Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | `stop_service_if_exists` + `start_service` |
| `supabase/functions/super-agent-install/index.ts` | Mesmas correcoes |

### Acao imediata no host

Apos o deploy, rodar `--update` novamente. Desta vez:
1. `stop_service_if_exists` para AMBOS os servicos (mata o supervisor velho com subprocess)
2. `start_service` inicia ambos como servicos independentes
3. `systemctl status iscope-supervisor` mostrara 1 processo
4. `systemctl status iscope-agent` mostrara 1 processo
5. `supervisor.log` sera criado pelo novo codigo

