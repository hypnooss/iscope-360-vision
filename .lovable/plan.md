

# Enriquecimento NSE baseado no nome do servico detectado

## Problema

O `nmap-enrich` atual usa apenas o dicionario `PORT_SCRIPTS` (mapeamento porta -> scripts). Servicos em portas nao-padrao (ex: web server na 65080, SSH na 65022) nunca sao enriquecidos.

## Solucao

Adicionar um segundo dicionario `SERVICE_SCRIPTS` que mapeia o **nome do servico** detectado pelo Nmap (campo `name` do XML, ex: `http`, `ssh`, `ftp`) para scripts NSE. O metodo `_enrich_with_contextual_scripts` passa a considerar ambos os mapeamentos.

## Plano Tecnico

### Arquivo: `python-agent/agent/executors/nmap.py`

**1. Novo dicionario `SERVICE_SCRIPTS` (apos `PORT_SCRIPTS`, linha 26)**

```python
SERVICE_SCRIPTS: Dict[str, List[str]] = {
    'http':      ['http-title', 'http-server-header', 'http-headers'],
    'https':     ['http-title', 'http-server-header', 'http-headers', 'ssl-cert'],
    'ssl':       ['ssl-cert', 'ssl-enum-ciphers'],
    'ssh':       ['ssh-hostkey', 'ssh2-enum-algos'],
    'ftp':       ['ftp-anon', 'ftp-syst'],
    'smtp':      ['smtp-commands', 'smtp-ntlm-info'],
    'snmp':      ['snmp-info', 'snmp-sysdescr'],
    'ldap':      ['ldap-rootdse'],
    'smb':       ['smb-os-discovery', 'smb-protocols', 'smb-security-mode'],
    'ms-sql-s':  ['ms-sql-info', 'ms-sql-ntlm-info'],
    'mysql':     ['mysql-info'],
    'ms-wbt-server': ['rdp-ntlm-info', 'rdp-enum-encryption'],
    'postgresql': ['pgsql-info'],
}
```

**2. Alterar `_enrich_with_contextual_scripts` (linhas 140-210)**

A logica de selecao de portas/scripts passa a ser:

```python
def _enrich_with_contextual_scripts(self, ip, services, timeout):
    scripts_by_port = {}  # Dict[int, List[str]]

    for svc in services:
        port = svc['port']
        scripts = []

        # 1. Mapeamento por porta fixa (prioridade)
        if port in PORT_SCRIPTS:
            scripts.extend(PORT_SCRIPTS[port])

        # 2. Mapeamento por nome do servico detectado
        svc_name = svc.get('name', '')
        if svc_name in SERVICE_SCRIPTS:
            for s in SERVICE_SCRIPTS[svc_name]:
                if s not in scripts:
                    scripts.append(s)

        if scripts:
            scripts_by_port[port] = scripts

    if not scripts_by_port:
        return services

    # Coletar scripts unicos e portas alvo
    target_ports = list(scripts_by_port.keys())
    all_scripts = []
    for sl in scripts_by_port.values():
        for s in sl:
            if s not in all_scripts:
                all_scripts.append(s)

    # ... resto do metodo permanece igual (cmd, subprocess, merge)
```

Isso garante que um `http` na porta 65080 ou `ssh` na 65022 sejam enriquecidos automaticamente.

## Resultado esperado

No log do scan anterior (portas 443, 541, 10443, 65022, 65080):
- Porta 443 (https) -> `http-title`, `http-server-header`, `http-headers`, `ssl-cert`
- Porta 65022 (ssh) -> `ssh-hostkey`, `ssh2-enum-algos`
- Porta 65080 (http) -> `http-title`, `http-server-header`, `http-headers`
- Porta 541 e 10443 -> enriquecidos se o Nmap identificar o servico

## Compatibilidade

- Python 3.9 compativel (usa `Dict` e `List` de `typing`)
- Nenhum import novo necessario
- `PORT_SCRIPTS` continua funcionando como antes (prioridade)
- Apenas 1 arquivo modificado

