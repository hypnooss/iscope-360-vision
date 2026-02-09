

# Ajuste de Descricoes das Regras de Compliance

## Objetivo

Padronizar e melhorar o campo `description` de todas as regras ativas para que cada texto represente claramente **que tipo de validacao** a regra executa. Com a remocao do codigo do card, a descricao agora e o principal texto exibido ao usuario em todos os status (pass, fail, not_found), entao precisa ser claro e autoexplicativo.

## Criterios de Padronizacao

- Todas as descricoes devem iniciar com **"Valida se..."** ou **"Verifica se..."** seguido da condicao avaliada
- Devem ser concisas (1-2 frases) e descrever a validacao, nao o impacto
- Remover redundancias com o nome da regra
- Manter tom tecnico mas acessivel

## Template: Dominio Externo (23 regras)

| Codigo | Nome | Descricao Atual | Nova Descricao |
|--------|------|----------------|----------------|
| DKIM-001 | DKIM Configurado | Verifica se o dominio possui pelo menos um registro DKIM valido. | Verifica a presenca de pelo menos um registro DKIM (DomainKeys Identified Mail) configurado no DNS do dominio. |
| DKIM-002 | Tamanho da Chave DKIM | Verifica se as chaves DKIM tem pelo menos 1024 bits (recomendado 2048 bits). | Verifica se as chaves DKIM utilizam pelo menos 1024 bits, conforme recomendacao minima de seguranca (ideal: 2048 bits). |
| DKIM-003 | Redundancia DKIM | Verifica se ha multiplos seletores DKIM para permitir rotacao de chaves. | Verifica se o dominio possui mais de um seletor DKIM configurado, permitindo rotacao segura de chaves. |
| DMARC-001 | DMARC Configurado | Verifica se o dominio possui registro DMARC para politicas de autenticacao de email. | Verifica a presenca de um registro DMARC (_dmarc) no DNS do dominio. |
| DMARC-002 | Politica DMARC Restritiva | Verifica se o DMARC utiliza politica "quarantine" ou "reject" para emails nao autenticados. | Verifica se a politica DMARC (p=) esta configurada como "quarantine" ou "reject" em vez de "none". |
| DMARC-003 | Relatorios DMARC (RUA) | Verifica se o DMARC possui endereco de relatorio agregado (rua) configurado. | Verifica se o registro DMARC inclui a tag rua= com endereco para recebimento de relatorios agregados. |
| DMARC-004 | Cobertura DMARC Total | Verifica se o DMARC aplica a politica a 100% dos emails (pct=100 ou ausente). | Verifica se a tag pct= do DMARC esta definida como 100 ou ausente, aplicando a politica a todos os emails. |
| DMARC-005 | Alinhamento SPF Estrito | Verifica se o DMARC exige alinhamento estrito de SPF (aspf=s). | Verifica se a tag aspf= do DMARC esta definida como "s" (strict), exigindo correspondencia exata de dominio no SPF. |
| DMARC-006 | Alinhamento DKIM Estrito | Verifica se o DMARC exige alinhamento estrito de DKIM (adkim=s). | Verifica se a tag adkim= do DMARC esta definida como "s" (strict), exigindo correspondencia exata de dominio no DKIM. |
| SPF-001 | Registro SPF Configurado | Verifica se o dominio possui um registro SPF configurado para autenticar emails enviados. | Verifica a presenca de um registro SPF (v=spf1) no DNS do dominio. |
| SPF-002 | Politica SPF Restritiva | Verifica se o registro SPF utiliza "-all" (hard fail) ou "~all" (soft fail). | Verifica se o mecanismo final do registro SPF e "-all" (hard fail) ou "~all" (soft fail), rejeitando servidores nao autorizados. |
| SPF-003 | Limite de DNS Lookups SPF | O SPF possui limite de 10 mecanismos... *(nao segue padrao)* | Verifica se o registro SPF nao ultrapassa o limite de 10 lookups DNS (include, a, mx, ptr, exists, redirect). |
| MX-001 | Registro MX Configurado | Verifica se o dominio possui registros MX para recebimento de emails. | Verifica a presenca de pelo menos um registro MX no DNS do dominio. |
| MX-002 | Redundancia MX | Verifica se ha pelo menos 2 servidores MX para alta disponibilidade. | Verifica se o dominio possui pelo menos dois registros MX distintos para garantir redundancia. |
| MX-003 | Prioridades MX Configuradas | Verifica se os registros MX possuem prioridades distintas para failover adequado. | Verifica se os registros MX utilizam valores de prioridade distintos para ordenacao correta de failover. |
| MX-004 | MX Aponta para Hostname | Verifica se os registros MX apontam para hostnames e nao diretamente para IPs. | Verifica se todos os registros MX apontam para hostnames (FQDN) e nao para enderecos IP, conforme RFC 2181. |
| MX-005 | Contato Administrativo DNS | Verifica se o registro SOA possui email de contato do administrador configurado. | Verifica se o campo RNAME do registro SOA contem um email de contato administrativo valido. |
| DNS-001 | DNSSEC Habilitado | Verifica se o dominio possui DNSSEC configurado para proteger contra ataques de DNS spoofing. | Verifica se o dominio possui DNSSEC habilitado com registros RRSIG validos. |
| DNS-002 | Registro DS na Zona Pai | Verifica se o registro DS esta publicado na zona pai para DNSSEC. | Verifica se o registro DS (Delegation Signer) esta publicado na zona pai, completando a cadeia de confianca DNSSEC. |
| DNS-003 | Redundancia de Nameservers | Verifica se o dominio possui pelo menos 2 nameservers para alta disponibilidade. | Verifica se o dominio possui pelo menos dois nameservers (NS) distintos configurados. |
| DNS-004 | Diversidade de Nameservers | Verifica se ha pelo menos 3 nameservers para melhor resiliencia. | Verifica se o dominio possui tres ou mais nameservers para maior resiliencia contra falhas. |
| DNS-005 | SOA Serial Atualizado | Verifica se o registro SOA possui serial number valido e recente. | Verifica se o serial number do registro SOA segue formato valido e indica atualizacao recente da zona DNS. |
| DNS-006 | SOA Refresh Adequado | Verifica se o tempo de refresh do SOA esta entre 1h e 24h. | Verifica se o intervalo de refresh do registro SOA esta entre 3600 e 86400 segundos (1h a 24h). |

## Template: FortiGate (33 regras)

| Codigo | Nome | Descricao Atual | Nova Descricao |
|--------|------|----------------|----------------|
| auth-001 | Criptografia LDAP | Verifica se os servidores LDAP estao configurados com LDAPS ou STARTTLS... | Verifica se os servidores LDAP utilizam conexao criptografada via LDAPS (porta 636) ou STARTTLS. |
| auth-002 | Redundancia RADIUS | Verifica se os servidores RADIUS estao configurados com boas praticas... | Verifica se ha servidores RADIUS secundarios configurados e se os timeouts estao dentro de valores adequados. |
| auth-003 | Fortinet SSO (FSSO) | Verifica se o FSSO esta configurado para integracao com AD... | Verifica se ha pelo menos um agente FSSO (Fortinet SSO) configurado para autenticacao transparente via Active Directory. |
| auth-004 | Integracao SAML | Verifica se o SAML esta configurado para SSO... | Verifica se ha um provedor de identidade SAML configurado para Single Sign-On com IdP corporativo. |
| bkp-001 | Backup Automatico | Verifica se backup automatico esta habilitado via automation stitch | Verifica se existe um automation stitch configurado para realizar backup automatico da configuracao do firewall. |
| fw-001 | Versao do Firmware | Verifica se o firmware esta na versao recomendada pela Fortinet | Verifica se a versao do firmware FortiOS instalada corresponde a uma versao estavel e recomendada pela Fortinet. |
| ha-001 | Alta Disponibilidade (HA) | Verifica se o firewall esta configurado em modo de alta disponibilidade | Verifica se o firewall esta operando em cluster de alta disponibilidade (ativo-passivo ou ativo-ativo). |
| ha-002 | Sincronizacao de Sessoes HA | Verifica se a sincronizacao de sessoes esta habilitada no cluster HA | Verifica se a opcao de sincronizacao de sessoes entre membros do cluster HA esta habilitada. |
| ha-003 | Heartbeat HA Redundante | Verifica se ha multiplas interfaces de heartbeat no cluster HA | Verifica se o cluster HA possui duas ou mais interfaces de heartbeat configuradas para evitar split-brain. |
| inb-001 | Restricao de Origem (Inbound) | Identifica regras de entrada (WAN-LAN) que aceitam qualquer IP de origem | Verifica se as regras de firewall de entrada (WAN para LAN) possuem restricao de IP de origem definida. |
| inb-002 | Exposicao RDP | Verifica se ha regras expondo RDP (3389) para a internet | Verifica se nenhuma regra de firewall permite acesso RDP (porta 3389/TCP) a partir da internet. |
| inb-003 | Exposicao SMB/CIFS | Verifica se ha regras expondo portas SMB (445, 139) para a internet | Verifica se nenhuma regra de firewall permite acesso SMB/CIFS (portas 445 e 139) a partir da internet. |
| int-001 | HTTP em Interfaces Externas | Verifica se HTTP esta habilitado em interfaces WAN | Verifica se o protocolo HTTP (nao criptografado) esta desabilitado nas interfaces WAN do firewall. |
| int-002 | HTTPS em Interfaces Externas | Verifica se HTTPS esta habilitado em interfaces WAN | Verifica se o acesso administrativo via HTTPS esta desabilitado ou restrito nas interfaces WAN. |
| int-003 | SSH em Interfaces Externas | Verifica se SSH esta habilitado em interfaces WAN | Verifica se o acesso SSH esta desabilitado ou restrito nas interfaces WAN do firewall. |
| int-004 | SNMP em Interfaces Externas | Verifica se SNMP esta habilitado em interfaces WAN | Verifica se o servico SNMP esta desabilitado nas interfaces WAN do firewall. |
| int-005 | ICMP Ping em Interfaces Externas | Verifica se ICMP Ping esta habilitado em interfaces WAN | Verifica se respostas a ICMP Ping estao desabilitadas nas interfaces WAN do firewall. |
| lic-001 | Contrato FortiCare | Verifica se o contrato de suporte FortiCare esta ativo | Verifica se o contrato de suporte FortiCare esta vigente e com data de expiracao futura. |
| lic-002 | Licencas FortiGuard | Verifica status das licencas de seguranca FortiGuard | Verifica se todas as licencas de servicos FortiGuard (AV, IPS, Web Filter, etc.) estao ativas e atualizando assinaturas. |
| log-001 | Logging de Eventos | Verifica se logging esta habilitado para eventos criticos | Verifica se o logging de trafego e eventos de seguranca esta habilitado no firewall. |
| log-002 | Centralizacao de Logs | Verifica se logs sao enviados para servidor externo | Verifica se os logs estao sendo enviados para um servidor externo (Syslog, FortiAnalyzer ou SIEM). |
| net-003 | Regras Any-Any | Verifica existencia de regras permissivas demais | Verifica se existem regras de firewall com origem, destino e servico configurados como "any" (totalmente permissivas). |
| sec-001 | Criptografia Forte (Strong Crypto) | Verifica se strong-crypto esta habilitado | Verifica se a opcao "strong-crypto" esta habilitada globalmente, restringindo o uso a cifras e protocolos TLS seguros. |
| sec-002 | Autenticacao Dois Fatores (2FA) | Verifica se 2FA esta habilitado para administradores | Verifica se as contas de administrador do firewall possuem autenticacao de dois fatores (2FA) habilitada. |
| sec-003 | Timeout de Sessao Administrativa | Verifica configuracao de timeout de sessao administrativa | Verifica se o timeout de inatividade da sessao administrativa esta configurado com valor igual ou inferior a 15 minutos. |
| utm-001 | IPS/IDS em Trafego Inbound | Verifica se IPS esta aplicado nas politicas de entrada | Verifica se as politicas de entrada (inbound) possuem um perfil IPS/IDS aplicado para deteccao de intrusoes. |
| utm-004 | Web Filter em Trafego Outbound | Verifica se Web Filter esta aplicado nas politicas de saida | Verifica se as politicas de saida (outbound) possuem um perfil de Web Filter aplicado para filtragem de conteudo. |
| utm-007 | Application Control | Verifica se App Control esta aplicado nas politicas de saida | Verifica se as politicas de saida (outbound) possuem um perfil de Application Control aplicado. |
| utm-009 | Antivirus de Gateway | Verifica se Antivirus esta aplicado nas politicas de saida | Verifica se as politicas de trafego possuem um perfil de antivirus aplicado para inspecao no perimetro. |
| vpn-001 | Criptografia VPN IPsec | Verifica se tuneis IPsec usam criptografia forte | Verifica se os tuneis VPN IPsec utilizam algoritmos de criptografia fortes (AES-256) e hashing seguro (SHA-256 ou superior). |
| vpn-003 | Versao TLS em VPN SSL | Verifica configuracoes de seguranca da VPN SSL | Verifica se a VPN SSL esta configurada para aceitar apenas conexoes TLS 1.2 ou superior. |

## Detalhes Tecnicos

As alteracoes serao feitas via SQL UPDATE diretamente na tabela `compliance_rules`. Sera gerado um bloco de UPDATE por regra, utilizando o `id` como chave primaria. Nenhuma alteracao de codigo e necessaria — apenas atualizacao de dados.

Exemplo de formato:
```text
UPDATE compliance_rules SET description = 'Nova descricao...' WHERE id = 'uuid';
```

Total: **53 regras** atualizadas em uma unica migracao SQL.

