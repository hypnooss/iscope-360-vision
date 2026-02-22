

# Otimizacao do Nmap Fingerprint: Scan Inteligente + Scripts de Seguranca

## Resumo

Tres melhorias no executor `nmap.py` do Super Agent:
1. Fundir o enriquecimento no scan principal para portas conhecidas
2. Adicionar scan direcionado para servicos em portas exoticas (nao-convencionais)
3. Adicionar 17 scripts NSE de seguranca aos mapeamentos

## Problema Atual

O Step 3 (fingerprint) roda o nmap ate 3 vezes por IP:
- Scan principal (`-sV` + `banner,ssl-cert`)
- Fallback (se zero fingerprints, retry com `--version-intensity 3`)
- Enriquecimento (`_enrich_with_contextual_scripts`) que roda scripts contextuais em TODAS as portas mapeadas, incluindo portas que ja foram cobertas no scan principal

Alem disso, servicos em portas nao-convencionais (ex: SSH na 65022, HTTP na 9443) nao recebem nenhum script contextual, perdendo dados de vulnerabilidade.

## Solucao: Modelo de Duas Fases

### Fase 1 — Scan principal (sempre executa)

Antes de rodar o nmap, pre-calcular os scripts para todas as portas usando `PORT_SCRIPTS`. Montar um unico comando:

```text
nmap -sT -Pn -sV --version-intensity 5
     --script=banner,ssl-cert,vulners,<scripts_por_porta>
     -p<portas>
     <ip>
```

Isso cobre 100% das portas conhecidas (21, 22, 80, 443, 445, 3389, etc.) com seus scripts contextuais numa unica execucao.

### Fase 2 — Enriquecimento de portas exoticas (condicional)

Apos parsear os resultados da Fase 1, o executor:

1. Itera cada servico retornado
2. Para cada servico, verifica se o `name` (detectado pelo `-sV`) tem mapeamento em `SERVICE_SCRIPTS`
3. Verifica se a porta desse servico JA foi coberta pelo `PORT_SCRIPTS` na Fase 1
4. Se o servico foi identificado mas a porta NAO tinha scripts pre-mapeados, marca essa porta para enriquecimento

Exemplo concreto:
- Fase 1 descobre porta 65022, o `-sV` identifica `service: ssh`
- Porta 65022 nao esta em `PORT_SCRIPTS`, entao nao recebeu `ssh-hostkey`, `ssh2-enum-algos`
- Fase 2 roda: `nmap -sT -Pn --script=ssh-hostkey,ssh2-enum-algos -p65022 <ip>`

Se nenhuma porta exotica precisar de enriquecimento (cenario mais comum), a Fase 2 nao executa.

### Fallback (mantido)

O retry com `--version-intensity 3` continua existindo, mas apenas com `--script=banner` para ser leve. Se o fallback detectar servicos, as portas exoticas desse fallback tambem passam pela Fase 2.

## Novos Scripts NSE de Seguranca

### Expansao do PORT_SCRIPTS

```text
Porta    Scripts existentes                             + Novos scripts
-----    ----------------------------------------       ----------------------------
21       ftp-anon, ftp-syst                             + ftp-bounce
22       ssh-hostkey, ssh2-enum-algos                   (sem alteracao)
25       smtp-commands, smtp-ntlm-info                  + smtp-open-relay
53       (novo)                                         dns-zone-transfer
80       (novo)                                         http-title, http-server-header,
                                                        http-headers, http-security-headers,
                                                        http-methods, http-robots.txt
161      snmp-info, snmp-sysdescr                       + snmp-brute
389      ldap-rootdse                                   (sem alteracao)
443      (novo)                                         http-title, http-server-header,
                                                        http-headers, ssl-cert,
                                                        ssl-enum-ciphers, ssl-heartbleed,
                                                        ssl-poodle, http-security-headers,
                                                        http-methods, http-robots.txt
445      smb-os-discovery, smb-protocols,               + smb-vuln-ms17-010
         smb-security-mode
587      smtp-commands, smtp-ntlm-info                  + smtp-open-relay
636      ldap-rootdse                                   + ssl-enum-ciphers, ssl-heartbleed
1433     ms-sql-info, ms-sql-ntlm-info                  (sem alteracao)
3306     mysql-info                                     + mysql-empty-password
3389     rdp-ntlm-info, rdp-enum-encryption             + rdp-vuln-ms12-020
5432     pgsql-info                                     (sem alteracao)
6379     (novo)                                         redis-info
8080     (novo)                                         http-title, http-server-header,
                                                        http-headers, http-security-headers,
                                                        http-methods
8443     (novo)                                         http-title, http-server-header,
                                                        http-headers, ssl-cert,
                                                        ssl-enum-ciphers, http-security-headers,
                                                        http-methods
27017    (novo)                                         mongodb-info
```

### Expansao do SERVICE_SCRIPTS

Esses mapeamentos sao usados na Fase 2 para portas exoticas:

```text
Servico          Scripts existentes                      + Novos scripts
-----------      ---------------------------------------- ----------------------------
http             http-title, http-server-header,          + http-security-headers,
                 http-headers                               http-methods, http-robots.txt
https            http-title, http-server-header,          + ssl-enum-ciphers, ssl-heartbleed,
                 http-headers, ssl-cert                     http-security-headers, http-methods,
                                                            http-robots.txt
ssl              ssl-cert, ssl-enum-ciphers               + ssl-heartbleed, ssl-poodle
ssh              ssh-hostkey, ssh2-enum-algos              (sem alteracao)
ftp              ftp-anon, ftp-syst                       + ftp-bounce
smtp             smtp-commands, smtp-ntlm-info            + smtp-open-relay
snmp             snmp-info, snmp-sysdescr                 + snmp-brute
ldap             ldap-rootdse                             (sem alteracao)
smb              smb-os-discovery, smb-protocols,         + smb-vuln-ms17-010
                 smb-security-mode
ms-sql-s         ms-sql-info, ms-sql-ntlm-info            (sem alteracao)
mysql            mysql-info                               + mysql-empty-password
ms-wbt-server    rdp-ntlm-info, rdp-enum-encryption      + rdp-vuln-ms12-020
postgresql       pgsql-info                               (sem alteracao)
redis            (novo)                                   redis-info
mongodb          (novo)                                   mongodb-info
domain/dns       (novo)                                   dns-zone-transfer
```

O script `vulners` e incluido globalmente no `--script=` da Fase 1, pois opera em qualquer servico com versao detectada pelo `-sV`.

## Fluxo completo apos as mudancas

```text
Portas do contexto (ex: [22, 80, 443, 445, 3306, 65022, 9443])
    |
    v
Pre-calculo de scripts por PORT_SCRIPTS
    -> porta 22:  ssh-hostkey, ssh2-enum-algos
    -> porta 80:  http-title, http-server-header, http-headers,
                  http-security-headers, http-methods, http-robots.txt
    -> porta 443: http-title, ..., ssl-cert, ssl-enum-ciphers,
                  ssl-heartbleed, ssl-poodle, http-security-headers, ...
    -> porta 445: smb-os-discovery, ..., smb-vuln-ms17-010
    -> porta 3306: mysql-info, mysql-empty-password
    -> porta 65022: (nenhum - porta exotica)
    -> porta 9443:  (nenhum - porta exotica)
    |
    v
FASE 1: nmap -sT -Pn -sV --version-intensity 5
        --script=banner,ssl-cert,vulners,ssh-hostkey,ssh2-enum-algos,
                 http-title,...,smb-vuln-ms17-010,mysql-info,...
        -p22,80,443,445,3306,65022,9443
    |
    v
Parse XML -> servicos detectados:
    -> 65022: name=ssh, product=OpenSSH, version=8.9
    -> 9443:  name=https, product=nginx, version=1.24
    |
    v
Verificar portas exoticas:
    -> 65022 nao esta em PORT_SCRIPTS, mas name=ssh esta em SERVICE_SCRIPTS
       Scripts faltantes: ssh-hostkey, ssh2-enum-algos
    -> 9443 nao esta em PORT_SCRIPTS, mas name=https esta em SERVICE_SCRIPTS
       Scripts faltantes: ssl-enum-ciphers, ssl-heartbleed, http-security-headers, ...
    |
    v
FASE 2 (condicional): nmap -sT -Pn
        --script=ssh-hostkey,ssh2-enum-algos,ssl-enum-ciphers,...
        -p65022,9443
    |
    v
Merge dos scripts da Fase 2 nos servicos da Fase 1
    |
    v
Retorno final com todos os servicos enriquecidos
```

## Secao tecnica: Mudancas no codigo

**Arquivo unico**: `python-agent/agent/executors/nmap.py`

### 1. Expandir `PORT_SCRIPTS` (dicionario no topo do arquivo)
Adicionar as novas portas (53, 80, 443, 6379, 8080, 8443, 27017) e os novos scripts nas portas existentes conforme tabela acima.

### 2. Expandir `SERVICE_SCRIPTS` (dicionario no topo do arquivo)
Adicionar novos servicos (redis, mongodb, domain/dns) e novos scripts nos servicos existentes conforme tabela acima.

### 3. Novo metodo `_compute_port_scripts(self, ports: List[int]) -> str`
- Itera as portas recebidas
- Coleta scripts de `PORT_SCRIPTS` para cada porta presente
- Retorna string unica de scripts (sem duplicatas) para usar no `--script=`

### 4. Novo metodo `_find_exotic_ports(self, services: List[Dict]) -> Dict[int, List[str]]`
- Itera os servicos retornados pela Fase 1
- Para cada servico, verifica se a porta esta em `PORT_SCRIPTS`
- Se NAO esta, verifica se o `name` do servico esta em `SERVICE_SCRIPTS`
- Compara os scripts do `SERVICE_SCRIPTS` com os scripts ja coletados na Fase 1
- Retorna um dicionario `{porta: [scripts_faltantes]}` apenas para portas que precisam de enriquecimento

### 5. Modificar metodo `run()`
- Antes do scan, chamar `_compute_port_scripts(ports)` para obter scripts por porta
- Montar comando com `--script=banner,ssl-cert,vulners,<scripts_computados>`
- Apos parse do XML, chamar `_find_exotic_ports(services)`
- Se houver portas exoticas, executar Fase 2 com os scripts faltantes
- Merge dos resultados da Fase 2 nos servicos existentes

### 6. Remover metodo `_enrich_with_contextual_scripts()`
Substituido pela logica de Fase 2 que e mais inteligente (so roda quando necessario, so nas portas que precisam).

### 7. Ajustar fallback
O fallback (retry com `--version-intensity 3`) mantem apenas `--script=banner` para ser rapido. Apos o fallback, os servicos detectados tambem passam pela verificacao de portas exoticas (Fase 2).

## Impacto no tempo de scan

- **Cenario tipico** (sem portas exoticas): scan unico, ~20-40% mais rapido que hoje
- **Cenario com portas exoticas** (raro): scan principal + scan pequeno direcionado, tempo similar ou levemente melhor que hoje
- **Pior caso**: mesma quantidade de execucoes que hoje (2), mas a segunda e menor e mais direcionada

## O que NAO muda

- Limite de 100 portas (mantido como esta)
- Logica de resiliencia (timeouts tratados como conclusoes validas)
- Formato de saida (campo `scripts` de cada servico)
- Frontend e motor de findings (nenhuma alteracao necessaria agora)
- httpx executor (nao afetado)
- Filosofia de stealth (T3, scan-delay respeitados)

