

# Redesign do Surface Analyzer V2 - De Dados Brutos para Inteligencia Acionavel

## O que deu errado na V1 das abas

A versao atual apenas redistribuiu os mesmos dados brutos em abas diferentes. O usuario continua olhando para IPs, portas e CVE-IDs sem entender **o que isso significa para o negocio**. Faltou a camada de inteligencia que ja existe no modulo de Compliance (Risco Tecnico, Impacto no Negocio, Recomendacao).

## Inspiracao: O padrao que ja funciona no iScope

O `UnifiedComplianceCard` ja resolve exatamente esse problema em outros modulos. Ele transforma dados tecnicos em **achados interpretados** com:
- Status visual (pass/fail/warning)
- Severidade com cor
- Mensagem contextual
- Recomendacao de acao
- Risco Tecnico e Impacto no Negocio (expandiveis)
- Evidencias coletadas

A proposta e aplicar esse **mesmo padrao mental** ao Surface Analyzer, criando "Findings" (achados) automaticos a partir dos dados brutos.

## Nova Arquitetura da Pagina

A pagina deixa de ser organizada por **tipo de dado** (inventario, servicos, CVEs, certs) e passa a ser organizada por **categoria de risco de exposicao**:

```text
+------------------------------------------------------------------+
|  HEADER + WORKSPACE SELECTOR + ACOES                             |
+------------------------------------------------------------------+
|  RESUMO EXECUTIVO (4 cards com contexto)                         |
|  [Ativos] [Servicos Expostos] [Vulnerabilidades] [Certificados]  |
+------------------------------------------------------------------+
|  FINDINGS POR CATEGORIA                                          |
|                                                                  |
|  [Servicos de Risco]  - portas/servicos perigosos expostos       |
|    Finding: "RDP (3389) exposto na internet"         [Critico]   |
|      > Risco Tecnico: Permite brute-force e lateral movement...  |
|      > Impacto: Acesso remoto nao autorizado a rede interna...   |
|      > Ativos afetados: server01 (1.2.3.4)                      |
|                                                                  |
|  [Vulnerabilidades]   - CVEs agrupadas por severidade            |
|    Finding: "CVE-2024-1234 - OpenSSH RCE"            [Critico]   |
|      > Risco Tecnico: Execucao remota de codigo sem autenticacao |
|      > Ativos afetados: 3 hosts                                 |
|                                                                  |
|  [Certificados TLS]   - problemas com certificados               |
|    Finding: "Certificado expirado ha 45 dias"        [Alto]      |
|      > Risco: Conexoes podem ser interceptadas (MITM)            |
|      > Ativo: mail.cliente.com.br                                |
|                                                                  |
|  [Tecnologias Obsoletas] - software desatualizado detectado      |
|    Finding: "Apache 2.4.29 detectado (EOL)"          [Medio]     |
|      > Risco: Versao sem suporte a patches de seguranca          |
|                                                                  |
|  [Credenciais Vazadas]  - HIBP (se houver)                       |
+------------------------------------------------------------------+
|  INVENTARIO TECNICO (aba secundaria, para quem quer drill-down)  |
+------------------------------------------------------------------+
```

## Categorias de Findings (gerados automaticamente dos dados)

O motor de findings analisa os dados do snapshot e gera achados inteligentes:

| Categoria | Logica de Geracao | Exemplos de Findings |
|---|---|---|
| **Servicos de Risco** | Detecta portas/servicos perigosos expostos (RDP, SMB, Telnet, FTP, MSSQL, MySQL, etc.) | "RDP exposto (porta 3389)", "SMB exposto (445)", "Banco de dados MySQL acessivel" |
| **Servicos Web** | Analisa headers de seguranca ausentes, paginas admin expostas, HTTP sem TLS | "Painel de administracao exposto", "HSTS ausente", "Pagina servida sem HTTPS" |
| **Vulnerabilidades** | CVEs agrupadas por severidade, com lista de ativos afetados | "CVE-2024-XXXX afeta 3 hosts", agrupado por Critical/High/Medium |
| **Certificados TLS** | Certs expirados, expirando em 30d, autoassinados, CN mismatch | "Certificado expirado ha 45 dias em mail.empresa.com" |
| **Tecnologias Obsoletas** | Versoes conhecidamente EOL ou desatualizadas | "PHP 7.4 detectado (EOL desde Nov 2022)" |
| **Credenciais Vazadas** | Dados do HIBP existente | Mantido como esta |

## Estrutura de um Finding

Cada finding sera um objeto que alimenta um card similar ao `UnifiedComplianceCard`:

```text
{
  name: "RDP (porta 3389) exposto na internet"
  status: "fail"
  severity: "critical"
  category: "Servicos de Risco"
  description: "O servico de Remote Desktop Protocol esta acessivel..."
  technicalRisk: "RDP e um dos vetores mais explorados para ransomware..."
  businessImpact: "Acesso nao autorizado pode resultar em..."
  recommendation: "Restringir acesso via VPN ou desabilitar se nao necessario"
  affectedAssets: [{ hostname, ip }]
  evidence: [{ port: 3389, service: "ms-wbt-server", version: "..." }]
}
```

## Regras de Deteccao de Servicos de Risco (built-in)

Mapa estatico de servicos/portas considerados perigosos quando expostos:

| Porta/Servico | Severidade | Risco Tecnico | Impacto |
|---|---|---|---|
| 3389 (RDP) | Critical | Brute-force, BlueKeep, ransomware | Acesso remoto total ao servidor |
| 445 (SMB) | Critical | EternalBlue, lateral movement | Acesso a arquivos e propagacao de malware |
| 23 (Telnet) | Critical | Credenciais em texto claro | Interceptacao de sessoes administrativas |
| 21 (FTP) | High | Credenciais em texto claro, anonymous | Exfiltracao de dados |
| 1433/3306/5432 (DBs) | Critical | Injecao SQL, acesso direto a dados | Vazamento de base de dados inteira |
| 6379 (Redis) | Critical | Sem autenticacao por padrao | Execucao de comandos no servidor |
| 27017 (MongoDB) | Critical | Sem autenticacao por padrao | Exposicao total dos dados |
| 5900 (VNC) | High | Autenticacao fraca | Controle visual remoto |
| 161 (SNMP) | Medium | Community strings padrao | Enumeracao completa da rede |
| HTTP sem TLS | Medium | Dados trafegam sem criptografia | Interceptacao de sessoes |
| Admin panels | High | Paginas de login expostas | Brute-force em interfaces admin |

## Deteccao de Tecnologias Obsoletas (built-in)

Mapa de versoes EOL conhecidas:

| Tecnologia | Versao EOL | Data EOL |
|---|---|---|
| PHP < 8.1 | 7.4, 8.0 | Nov 2022, Nov 2023 |
| Apache < 2.4.58 | Versoes antigas | Varias |
| OpenSSH < 9.0 | Versoes antigas | Varias |
| nginx < 1.24 | Versoes antigas | Varias |
| Windows Server 2012 | Todas | Out 2023 |

## Mudancas Tecnicas

### Arquivo: `src/pages/external-domain/SurfaceAnalyzerV2Page.tsx` (reescrever)

1. **Novo motor `generateFindings(assets)`**: funcao pura que recebe a lista de `ExposedAsset[]` e retorna `SurfaceFinding[]` com todas as categorias acima
2. **Tipo `SurfaceFinding`**: interface inspirada em `UnifiedComplianceItem` mas adaptada para surface (sem code/rawData, com `affectedAssets`)
3. **Componente `SurfaceFindingCard`**: card visual identico ao padrao do `UnifiedComplianceCard` com 3 niveis (visao rapida, contexto estrategico, detalhes expandiveis)
4. **Componente `SurfaceCategorySection`**: agrupa findings por categoria, com contadores de severidade, identico ao `ExternalDomainCategorySection`
5. **Manter as abas mas com proposito diferente**:
   - **Aba "Analise" (padrao)**: Findings organizados por categoria
   - **Aba "Inventario"**: Tabela tecnica para drill-down (a tabela que ja existe)
   - **Aba "Credenciais Vazadas"**: HIBP existente
6. **Summary Cards atualizados**: Em vez de contar "servicos", contar "findings criticos", "findings totais", etc.

### Arquivo: `src/App.tsx`

Sem alteracao (rota ja existe).

## Resultado Esperado

- Usuario leigo: ve "3 problemas criticos" com explicacao em linguagem acessivel
- Usuario tecnico: expande o finding e ve portas, CVEs, evidencias, pode ir ao Inventario para drill-down
- Gestor: entende o impacto no negocio de cada achado sem precisar saber o que e "porta 3389"

## Observacoes

- Os findings sao gerados 100% no frontend a partir dos dados do snapshot (sem backend novo)
- O mapa de servicos de risco e tecnologias obsoletas e estatico (hardcoded), pode ser movido para o banco depois
- Sem risk score numerico (conforme preferencia do usuario)
- A aba Inventario preserva a tabela tecnica para quem precisa de detalhes granulares

