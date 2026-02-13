

# Corrigir permissao de raw socket para o nmap

## Problema

O nmap esta rodando sem a permissao `CAP_NET_RAW`, resultando no aviso:

```
You have specified some options that require raw socket access.
These options will not be honored without the necessary privileges.
```

Sem essa permissao, o nmap:
- Nao consegue fazer SYN scan (cai para connect scan, mais lento e detectavel)
- Perde capacidade de OS detection
- Pode falhar em fingerprinting de versao em alguns casos

O instalador do Super Agent ja aplica `setcap cap_net_raw+ep` no masscan, mas esquece de fazer o mesmo para o nmap.

## Solucao

Adicionar o `setcap cap_net_raw+ep` ao binario do nmap no script de instalacao, identico ao que ja e feito para o masscan.

## Detalhes tecnicos

### Arquivo: `supabase/functions/super-agent-install/index.ts`

Apos a linha 252 (apos o bloco de instalacao do nmap), adicionar:

```bash
# Conceder CAP_NET_RAW ao nmap (necessario para SYN scan e OS detection sem root)
local nmap_path
nmap_path="$(command -v nmap 2>/dev/null || echo '/usr/bin/nmap')"
if [[ -x "$nmap_path" ]]; then
  echo "Configurando CAP_NET_RAW para nmap em $nmap_path..."
  setcap cap_net_raw+ep "$nmap_path" 2>/dev/null || {
    echo "Aviso: falha ao configurar CAP_NET_RAW para nmap."
  }
fi
```

## Observacao

Os agentes ja instalados precisarao ser reinstalados (ou atualizado o componente) para que a permissao seja aplicada. Novos agentes ja receberao a correcao automaticamente.

