

# Corrigir Nmap para SYN Scan via sudo

## Problema

O `setcap cap_net_raw+ep` nao funciona no nmap porque ele e um binario com linkagem dinamica. O kernel Linux remove capabilities de binarios que carregam bibliotecas compartilhadas (protecao contra LD_PRELOAD). O masscan funciona porque e estaticamente linkado.

Por isso, mesmo com `setcap` e `AmbientCapabilities=CAP_NET_RAW`, o nmap cai para connect scan (menos preciso e mais detectavel).

## Solucao

Permitir que o usuario `iscope` execute nmap via `sudo` sem senha, e alterar o executor Python para usar `sudo nmap` em vez de `nmap`.

## Alteracoes

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/super-agent-install/index.ts` (~linha 800) | Adicionar regra sudoers para nmap: `iscope ALL=(ALL) NOPASSWD: /usr/bin/nmap` |
| `python-agent/agent/executors/nmap.py` (linha 43 e 76) | Prefixar comandos com `sudo`: `['sudo', 'nmap', '-sS', '-sV', ...]` |
| `python-agent/agent/executors/nmap.py` | Trocar `-sV` por `-sS -sV` (SYN scan explicito + version detection) |
| `python-agent/agent/version.py` | Atualizar versao para `1.2.9` |

## Detalhe tecnico

### Sudoers (super-agent-install)

Na funcao `setup_sudoers`, adicionar a permissao do nmap junto com a do systemctl:

```
iscope ALL=(ALL) NOPASSWD: /bin/systemctl restart iscope-super-agent
iscope ALL=(ALL) NOPASSWD: /usr/bin/nmap
```

### Executor nmap.py

Comando primario (antes):
```
nmap -sV --version-intensity 5 -p80,443 target -oX - -T3 ...
```

Comando primario (depois):
```
sudo nmap -sS -sV --version-intensity 5 -p80,443 target -oX - -T3 ...
```

A flag `-sS` forca SYN stealth scan (mais preciso, menos detectavel). O `sudo` garante acesso a raw sockets sem depender de setcap/capabilities.

O mesmo ajuste sera aplicado ao comando fallback.

### check-deps.sh

A linha `setcap cap_net_raw+ep` do nmap (linha 463) pode ser mantida como fallback, mas nao sera mais necessaria.

## Apos aplicar

1. Redesenhar (deploy) a edge function `super-agent-install`
2. Subir versao 1.2.9 no servidor
3. O nmap deve deixar de emitir o warning e usar SYN scan real (visivel no log como "SYN Stealth Scan" em vez de "Connect Scan")

