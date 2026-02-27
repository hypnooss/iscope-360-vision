

## Novas Fontes de CVE Baseadas nos Dados de Surface Scan

### Analise

Cruzando os produtos detectados nos snapshots de Surface Scan com as fontes de CVE ja cadastradas:

**Fontes existentes (external_domain):** Apache HTTP Server, Exim, jQuery, Microsoft IIS, Nginx, Node.js, OpenSSH, OpenSSL, PHP

**Produtos detectados nos scans que NAO tem fonte de CVE:**

| Produto Detectado | product_filter sugerido | Relevancia |
|---|---|---|
| ISC BIND (DNS) | `ISC BIND` | Servidor DNS exposto, versoes 9.11.x detectadas |
| Dovecot (IMAP/POP3) | `dovecot` | Servidor de email exposto |
| Postfix (SMTP) | `postfix` | Servidor de email exposto |
| MikroTik RouterOS | `MikroTik RouterOS` | Roteadores expostos com SSH, FTP, API, HTTP |
| Jetty (HTTP) | `jetty` | Web server Java, versao 11.0.16 detectada |
| ProFTPD | `proftpd` | Servidor FTP exposto |
| vsftpd | `vsftpd` | Servidor FTP exposto |
| Pure-FTPd | `pure-ftpd` | Servidor FTP exposto |
| MariaDB / MySQL | `mariadb` | Banco de dados exposto |
| LiteSpeed | `litespeed` | Web server |
| Cisco ASA | `Cisco ASA` | VPN/Firewall exposto |
| Hikvision | `hikvision` | Cameras IP expostas (DVR, NVR, IPCam) |
| Tornado (Python) | `tornado` | Web server Python |
| Microsoft Exchange | `Microsoft Exchange` | SMTP Exchange exposto |
| FortiMail | `FortiMail` | Appliance Fortinet de email |
| Subversion (SVN) | `subversion` | Controle de versao exposto |
| SAP NetWeaver | `SAP NetWeaver` | ERP exposto |
| Caddy | `caddy` | Web server moderno |
| Kestrel (.NET) | `kestrel` | Web server .NET |

### Plano de Implementacao

Inserir as fontes de CVE mais relevantes na tabela `cve_sources` via SQL INSERT. Priorizando por criticidade de exposicao:

**Prioridade Alta (servicos criticos expostos):**
1. ISC BIND
2. Dovecot
3. Postfix
4. MikroTik RouterOS
5. Microsoft Exchange
6. MariaDB
7. Cisco ASA

**Prioridade Media (servicos comuns):**
8. ProFTPD
9. vsftpd
10. Pure-FTPd
11. Hikvision
12. FortiMail
13. LiteSpeed
14. Jetty

**Prioridade Baixa (menos impacto):**
15. Tornado
16. Subversion
17. SAP NetWeaver
18. Caddy
19. Kestrel

### Alteracao

Um unico INSERT SQL na tabela `cve_sources` com as novas fontes (module_code = 'external_domain', source_type = 'nist_nvd_web'), usando o mesmo padrao das fontes existentes. O `refresh-cve-cache` ja suporta `nist_nvd_web` nativamente, entao nenhuma alteracao de codigo e necessaria.

Sugiro adicionar as 14 fontes de prioridade alta e media, que cobrem todos os produtos realmente criticos detectados nos scans.

