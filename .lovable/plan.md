

# Enriquecimento por Scripts NSE Contextuais no Nmap Fingerprint

## Objetivo

Adicionar scripts NSE especificos por porta/servico ao scan de fingerprinting do nmap, coletando informacoes detalhadas como nomes de servidores, protocolos de criptografia e metadados do sistema operacional.

## O que ja funciona

- O executor `nmap.py` ja executa `--script=banner,ssl-cert` em todas as portas
- O parser XML ja extrai o output de qualquer script NSE para o campo `scripts` do servico
- O frontend ja exibe os dados de `scripts` nos cards do Attack Surface Analyzer

## O que falta

Adicionar scripts NSE especificos para portas/servicos conhecidos, como o exemplo do RDP que trouxe `rdp-ntlm-info` e `rdp-enum-encryption`.

## Estrategia: Mapeamento Porta/Servico para Scripts NSE

Criar um dicionario de scripts adicionais por porta no executor `nmap.py`. Apos o scan principal (que ja coleta `banner` e `ssl-cert`), executar um segundo scan direcionado apenas nas portas que tem scripts especificos disponiveis.

### Mapeamento Proposto

| Porta | Servico | Scripts NSE |
|---|---|---|
| 3389 | RDP | `rdp-ntlm-info`, `rdp-enum-encryption` |
| 445 | SMB | `smb-os-discovery`, `smb-protocols`, `smb-security-mode` |
| 22 | SSH | `ssh-hostkey`, `ssh2-enum-algos` |
| 21 | FTP | `ftp-anon`, `ftp-syst` |
| 25/587 | SMTP | `smtp-commands`, `smtp-ntlm-info` |
| 1433 | MSSQL | `ms-sql-info`, `ms-sql-ntlm-info` |
| 3306 | MySQL | `mysql-info` |
| 5432 | PostgreSQL | `pgsql-info` |
| 161 | SNMP | `snmp-info`, `snmp-sysdescr` |
| 389/636 | LDAP | `ldap-rootdse` |

### Implementacao

**Arquivo: `python-agent/agent/executors/nmap.py`**

1. Adicionar constante `PORT_SCRIPTS` com o mapeamento porta -> lista de scripts
2. Apos o scan principal, identificar quais portas abertas tem scripts adicionais
3. Se houver portas com scripts extras, executar um segundo `nmap` direcionado:
   - Apenas `-sT` (sem `-sV`, pois ja foi feito)
   - Apenas as portas com scripts mapeados
   - Timeout reduzido (`--host-timeout 60s`)
4. Fazer merge dos resultados: adicionar os scripts do segundo scan ao servico correspondente

### Logica do Segundo Scan

```text
scan principal (banner, ssl-cert, -sV)
        |
   portas abertas encontradas
        |
   filtrar: quais tem scripts extras no PORT_SCRIPTS?
        |
   nenhuma? -> fim
        |
   sim -> nmap -sT --script=<scripts> -p<portas> <ip>
        |
   merge scripts no servico existente
```

### Exemplo de Resultado Enriquecido (porta 3389)

```text
{
  "port": 3389,
  "product": "Microsoft Terminal Services",
  "version": "",
  "name": "ms-wbt-server",
  "scripts": {
    "banner": "...",
    "ssl-cert": "Subject: commonName=SRVPSOFFICE ...",
    "rdp-ntlm-info": "Target_Name: SRVPSOFFICE\nNetBIOS_Computer_Name: SRVPSOFFICE\nProduct_Version: 10.0.14393",
    "rdp-enum-encryption": "CredSSP (NLA): SUCCESS\nCredSSP with Early User Auth: SUCCESS\nRDSTLS: SUCCESS"
  }
}
```

### Controle de Tempo

- O segundo scan e rapido pois nao faz deteccao de versao (`-sV`)
- Timeout dedicado de 60s para nao impactar o pipeline
- Se o segundo scan falhar ou der timeout, os dados do scan principal sao preservados

## Frontend (Fase Futura - nao incluso agora)

Os dados dos scripts ja sao exibidos no card expandido. Em uma fase posterior, podemos criar um parser visual para scripts conhecidos (ex: exibir o `Target_Name` do `rdp-ntlm-info` como "Hostname: SRVPSOFFICE" em vez do output bruto).

## Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `python-agent/agent/executors/nmap.py` | Adicionar mapeamento PORT_SCRIPTS e logica de segundo scan direcionado |

## Impacto no Tempo de Scan

- Scan atual: ~2 min por IP
- Com enriquecimento: +30-60s por IP (apenas para portas com scripts mapeados)
- Sem impacto se nenhuma porta mapeada for encontrada

