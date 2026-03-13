

## Adicionar PnP.PowerShell à instalação automática de componentes

### Como funciona hoje
O `ComponentManager` em `components.py` verifica e instala 3 componentes: PowerShell Core, módulos M365 (Exchange + Graph) e certificado. Esse check roda:
- Automaticamente em cada **update** do agente (`updater.py` → `ensure_system_components()`)
- Sob demanda via **heartbeat** (`check_components` flag → `check-deps.sh`)

### Alteração
**Arquivo:** `python-agent/agent/components.py`

1. **`_check_m365_modules`** — adicionar `PnP.PowerShell` à verificação:
   ```
   (Get-Module -ListAvailable PnP.PowerShell)
   ```

2. **`_install_m365_modules`** — adicionar ao `install_cmd`:
   ```
   Install-Module -Name PnP.PowerShell -Scope AllUsers -Force -AllowClobber
   ```

### Após deploy
Empacotar novo release do agente (`tar.gz` no bucket). Na próxima verificação de update, o Supervisor:
1. Baixa o pacote
2. Instala
3. Chama `ensure_system_components()`
4. Detecta `PnP.PowerShell` ausente → instala automaticamente

Nenhuma intervenção manual necessária.

