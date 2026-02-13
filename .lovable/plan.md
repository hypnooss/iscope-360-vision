

# Tornar o Nmap mais furtivo e eficaz

## Resumo

Reescrever o executor Nmap para usar uma abordagem stealth-first que imita trafego humano real, com fallback inteligente quando o scan primario nao retorna resultados. O compromisso e com o sucesso na coleta de dados, nao com velocidade.

## Mudancas no arquivo `python-agent/agent/executors/nmap.py`

### Scan primario - stealth sem scripts

Substituir o comando atual agressivo por um scan furtivo:

```text
ANTES                          DEPOIS
-----                          ------
-sV -sC                       -sV (sem scripts ruidosos)
-T4 (agressivo)                -T3 (normal, ritmo humano)
--host-timeout 180s            --host-timeout 300s
(sem evasao)                   --scan-delay 500ms
                               --max-retries 2
                               --data-length 24
                               --version-intensity 5
timeout geral = 300s           timeout geral = 600s
```

### Fallback com scripts seletivos

Se o scan primario retornar zero servicos (bloqueio por firewall/WAF), executar um segundo scan com scripts leves e especificos:

- `banner` - captura banners de FTP, SSH, SMTP
- `ssl-cert` - detalhes do certificado TLS
- `http-title` - titulo da pagina web

Esses 3 scripts sao rapidos e capturam as informacoes mais uteis para identificacao e CVE matching.

### Diagnostico via stderr

Sempre logar o stderr do nmap (onde aparecem avisos de timeout, rate-limiting e bloqueios), facilitando troubleshooting futuro.

### Parser XML - sem alteracoes

O parser `_parse_nmap_xml` e `_parse_os_info` permanecem identicos. O problema nunca foi o parsing, mas sim a falta de dados no XML causada por timeout e bloqueio.

## Impacto esperado

- Hosts que antes retornavam zero servicos passarao a ter produto/versao detectados
- Com versoes capturadas, o matching de CVEs passara a funcionar para esses IPs
- O agendamento automatico com balanceamento absorve o tempo extra sem impacto operacional

