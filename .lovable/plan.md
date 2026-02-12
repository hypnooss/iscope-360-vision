
# Script de Instalacao do Super Agent

## Resumo

Criar uma nova Edge Function `super-agent-install` que serve um script bash dedicado para instalacao de Super Agents. Esse script e uma versao simplificada do `agent-install` existente, mas adaptada para o perfil do Super Agent:

- **Inclui**: masscan, nmap, httpx (ferramentas de scan ativo)
- **Exclui**: PowerShell, modulos M365, certificados M365, Amass
- **Adiciona**: flag `is_system_agent.flag` em `/var/lib/iscope-agent/`

## Diferencas entre Agent Regular vs Super Agent

```text
+-------------------------+------------------+------------------+
| Componente              | Agent Regular    | Super Agent      |
+-------------------------+------------------+------------------+
| Python + venv           | Sim              | Sim              |
| Amass                   | Sim              | Nao              |
| PowerShell Core         | Sim              | Nao              |
| Modulos M365            | Sim              | Nao              |
| Certificado M365        | Sim              | Nao              |
| masscan                 | Nao              | Sim              |
| nmap                    | Nao              | Sim              |
| httpx                   | Nao              | Sim              |
| is_system_agent.flag    | Nao              | Sim              |
| systemd service         | Sim              | Sim (mesmo)      |
| check-deps.sh           | Sim              | Sim (ja adaptado)|
+-------------------------+------------------+------------------+
```

## Arquivos a Criar

### 1. `supabase/functions/super-agent-install/index.ts`

Nova Edge Function (publica, sem JWT) que retorna o script bash de instalacao. Estrutura identica ao `agent-install`:
- Mesmo fluxo: parse args, require root, detect OS, install deps, download release, setup venv, write env, write systemd, start service
- Substitui `install_amass()` + `install_powershell()` + `generate_m365_certificate()` por `install_scanner_tools()` que instala masscan, nmap e httpx
- Adiciona criacao do arquivo `/var/lib/iscope-agent/is_system_agent.flag` em `ensure_dirs()`
- O `check-deps.sh` embutido ja esta adaptado (feito na Fase 1) para detectar a flag e instalar as ferramentas

## Arquivos a Editar

### 2. `src/components/agents/AgentInstallInstructions.tsx`

Adicionar prop opcional `isSuperAgent` que altera a URL de instalacao para `super-agent-install` e ajusta o texto de pre-requisitos.

### 3. `src/pages/admin/SuperAgentsPage.tsx`

Passar `isSuperAgent={true}` ao componente `AgentInstallInstructions`.

### 4. `supabase/config.toml`

Registrar a nova funcao `super-agent-install` com `verify_jwt = false` (endpoint publico, mesmo padrao do `agent-install`).

## Detalhes Tecnicos do Script

O script `super-agent-install` segue o mesmo padrao do instalador atual mas com as seguintes funcoes substituidas:

**install_scanner_tools()** (substitui install_amass + install_powershell + generate_m365_certificate):

```text
1. masscan:
   - apt install -y masscan (Debian/Ubuntu)
   - dnf install -y masscan (RHEL/CentOS)

2. nmap:
   - apt install -y nmap (Debian/Ubuntu)
   - dnf install -y nmap (RHEL/CentOS)

3. httpx (projectdiscovery):
   - Detecta arquitetura (amd64/arm64)
   - Baixa release v1.6.9 do GitHub
   - Extrai para /usr/local/bin/httpx
```

**ensure_dirs()** adicional:
```text
touch /var/lib/iscope-agent/is_system_agent.flag
```

Essa flag e lida pelo `check-deps.sh` (ja implementado na Fase 1) para instalar/verificar as ferramentas de scan em cada restart do servico.

## Fluxo de Instalacao

```text
Admin cria Super Agent na UI
         |
         v
Recebe codigo de ativacao
         |
         v
curl -fsSL .../super-agent-install | sudo bash -s -- --activation-code "XXXX"
         |
         v
1. Instala Python + venv
2. Instala masscan, nmap, httpx
3. Baixa release do agent (mesmo pacote)
4. Cria flag is_system_agent.flag
5. Registra servico systemd
6. Inicia servico -> agent faz register -> heartbeat -> pega tasks da fila
```
