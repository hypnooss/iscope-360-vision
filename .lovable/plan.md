

# Plano: Análise de Segurança e Compliance do Entra ID

## Visao Geral

Implementar um sistema de **análise de segurança do Entra ID** que identifica configurações inseguras, políticas ausentes e lacunas de segurança - seguindo o mesmo padrão já existente para análise de Firewalls.

O objetivo é coletar dados de configuração via Microsoft Graph API e avaliar:
- Configurações de segurança ausentes ou fracas
- Políticas de acesso condicional mal configuradas
- Usuários sem MFA habilitado
- Métodos de autenticação inseguros permitidos
- Security Defaults desabilitados sem políticas alternativas

## Arquitetura

```text
+-------------------------------------------------------------------+
|                         Frontend                                   |
|  +---------------------------------------------------------------+|
|  | EntraIdAnalysisPage.tsx                                       ||
|  | - Reutiliza: ScoreGauge, StatCard, CategorySection            ||
|  | - Dashboard com score geral                                    ||
|  | - Categorias: Autenticacao, Acesso Condicional, Usuarios, etc ||
|  | - Botao "Analisar" e "Exportar PDF"                           ||
|  +---------------------------------------------------------------+|
+-------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------+
|              Edge Function: entra-id-compliance                   |
|  - Autentica via Client Credentials                               |
|  - Consulta multiplos endpoints do Graph API                      |
|  - Executa verificacoes de compliance                             |
|  - Retorna ComplianceReport com categorias e checks               |
+-------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------+
|                    Microsoft Graph API                            |
|  GET /policies/identitySecurityDefaultsEnforcementPolicy          |
|  GET /identity/conditionalAccess/policies                         |
|  GET /reports/authenticationMethods/userRegistrationDetails       |
|  GET /policies/authenticationMethodsPolicy                        |
|  GET /users (filtros para admins)                                 |
|  GET /directoryRoles                                              |
+-------------------------------------------------------------------+
```

## Categorias de Verificacao

### 1. Security Defaults e Baseline
| ID | Verificacao | Severidade | Descricao |
|----|-------------|------------|-----------|
| SD-001 | Security Defaults Habilitado | Critical | Verifica se Security Defaults esta ativo (baseline para tenants sem P1/P2) |
| SD-002 | Security Defaults ou CA Policies | Critical | Se Security Defaults desabilitado, verifica se ha Conditional Access como alternativa |

### 2. Autenticacao Multi-Fator (MFA)
| ID | Verificacao | Severidade | Descricao |
|----|-------------|------------|-----------|
| MFA-001 | MFA para Administradores | Critical | Todos os admins globais devem ter MFA registrado |
| MFA-002 | Taxa de Adocao MFA | High | Percentual de usuarios com MFA registrado (alvo: >90%) |
| MFA-003 | MFA em Acesso Condicional | High | Existe policy exigindo MFA para acessos sensiveis |

### 3. Metodos de Autenticacao
| ID | Verificacao | Severidade | Descricao |
|----|-------------|------------|-----------|
| AUTH-001 | SMS como MFA | Medium | SMS ainda habilitado como metodo (menos seguro) |
| AUTH-002 | Voice Call habilitado | Medium | Ligacao telefonica habilitada (vulneravel a SIM swap) |
| AUTH-003 | Authenticator App Enforced | Low | Microsoft Authenticator como metodo preferencial |

### 4. Acesso Condicional (requer P1/P2)
| ID | Verificacao | Severidade | Descricao |
|----|-------------|------------|-----------|
| CA-001 | Bloquear Legacy Auth | Critical | Policy bloqueando protocolos legados (IMAP, POP3, etc) |
| CA-002 | MFA para Admins | Critical | Policy exigindo MFA para roles administrativos |
| CA-003 | Bloquear Locais Nao Confiavel | High | Restricao geografica ou IP para acessos sensiveis |
| CA-004 | Dispositivos Compliant | Medium | Exigir dispositivos gerenciados/compliant |
| CA-005 | Sign-in Risk Policy | High | Bloquear/exigir MFA em logins de risco |

### 5. Usuarios Privilegiados
| ID | Verificacao | Severidade | Descricao |
|----|-------------|------------|-----------|
| PRIV-001 | Numero de Global Admins | High | Limite recomendado: 2-4 Global Admins |
| PRIV-002 | Admins sem MFA | Critical | Administradores sem MFA registrado |
| PRIV-003 | Contas de Emergencia | Medium | Existem break-glass accounts configuradas |

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/entra-id-compliance/index.ts` | Criar | Edge function principal de analise |
| `supabase/config.toml` | Modificar | Registrar nova edge function |
| `src/pages/m365/EntraIdAnalysisPage.tsx` | Criar | Pagina de analise (reutiliza componentes) |
| `src/types/entraIdCompliance.ts` | Criar | Tipos especificos para M365 compliance |
| `src/App.tsx` | Modificar | Adicionar rota |
| `src/pages/m365/EntraIdPage.tsx` | Modificar | Atualizar cards para refletir novo proposito |

## Detalhes Tecnicos

### 1. Edge Function: entra-id-compliance

Parametros de entrada:
- `tenant_record_id`: ID do tenant no banco de dados

Fluxo de execucao:
1. Validar JWT do usuario
2. Buscar credenciais (app_id de m365_global_config, tenant_id de m365_tenants)
3. Obter access_token via Client Credentials
4. Executar verificacoes em paralelo:
   - Security Defaults status
   - Conditional Access policies (se disponivel)
   - MFA registration status
   - Authentication methods policy
   - Directory roles (para contar admins)
5. Calcular score e retornar ComplianceReport

Tratamento de Licenciamento:
- Endpoints que requerem P1/P2 retornarao 403
- Nesses casos, marcar verificacao como "pending" com nota sobre licenciamento
- Nao falhar toda a analise por falta de licenca

### 2. Estrutura de Retorno

```typescript
interface EntraIdComplianceReport {
  overallScore: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  categories: ComplianceCategory[];
  generatedAt: Date;
  tenantInfo: {
    tenantId: string;
    displayName: string;
    domain: string;
  };
  licensingNotes?: string[];
}
```

### 3. Permissoes Graph API Necessarias

As permissoes ja configuradas cobrem os endpoints:
- `Directory.Read.All` - Usuarios, roles, grupos
- `AuditLog.Read.All` - Logs de auditoria
- `Policy.Read.All` - Conditional Access, Auth Methods (precisa adicionar)
- `Reports.Read.All` - Relatorios de MFA (precisa adicionar)

**Nota**: Sera necessario adicionar `Policy.Read.All` e `Reports.Read.All` ao App Registration para funcionamento completo.

## Fluxo de Usuario

```text
1. Usuario acessa /scope-m365/entra-id
   |
2. Ve card "Analise de Seguranca" e clica
   |
3. Pagina EntraIdAnalysisPage carrega
   |
4. Se ja houver analise anterior, exibe resultados
   |
5. Usuario clica "Analisar"
   |
6. Edge function executa todas as verificacoes
   |
7. Resultados exibidos no Dashboard:
   +-- Score Gauge (0-100)
   +-- Cards: Total, Aprovadas, Falhas, Alertas
   +-- Categorias expandiveis com checks
   +-- Cada check com evidencias e recomendacoes
   |
8. Usuario pode exportar PDF do relatorio
```

## Consideracoes

### Licenciamento Azure AD
- Algumas verificacoes (Conditional Access) requerem licenca P1/P2
- O sistema deve funcionar parcialmente mesmo sem essas licencas
- Verificacoes indisponiveis serao marcadas como "pending" com explicacao

### Permissoes Adicionais
Para funcionamento completo, o App Registration precisara de:
- `Policy.Read.All` - Ler politicas de Conditional Access
- `Reports.Read.All` - Ler relatorios de autenticacao

### Persistencia
- Resultados podem ser salvos em tabela `m365_analysis_history` (similar a `analysis_history` de firewalls)
- Permite comparar evolucao do score ao longo do tempo

## Proximos Passos apos Implementacao

1. Adicionar mais verificacoes conforme CIS Benchmark para Microsoft 365
2. Implementar agendamento de analises automaticas
3. Criar alertas quando score cair abaixo de threshold
4. Dashboard consolidado mostrando score de todos os tenants

