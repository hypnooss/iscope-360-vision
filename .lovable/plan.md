
# Plano: Implementar Logs de Auditoria do Entra ID

## Visão Geral

Criar a funcionalidade completa de visualização de logs de auditoria do Microsoft Entra ID, permitindo que usuários visualizem eventos de sign-in e alterações de diretório do tenant conectado.

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ EntraIdAuditLogsPage.tsx                                    ││
│  │ - Tabela de logs com filtros                                ││
│  │ - Tabs: Sign-In Logs | Directory Audits                     ││
│  │ - Filtros: data, usuário, resultado (sucesso/falha)         ││
│  │ - Paginação                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Edge Function: entra-id-audit-logs                 │
│  - Recebe tenant_record_id e parâmetros de filtro               │
│  - Busca client_secret de m365_global_config                    │
│  - Decripta e obtém access_token                                │
│  - Chama Microsoft Graph API                                    │
│  - Retorna logs formatados                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Microsoft Graph API                           │
│  GET /auditLogs/signIns       → Logs de login                   │
│  GET /auditLogs/directoryAudits → Alterações no diretório       │
└─────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/entra-id-audit-logs/index.ts` | Criar | Edge function para buscar logs via Graph API |
| `supabase/config.toml` | Modificar | Registrar nova edge function |
| `src/pages/m365/EntraIdAuditLogsPage.tsx` | Criar | Página de visualização de logs |
| `src/hooks/useEntraIdAuditLogs.ts` | Criar | Hook para buscar e gerenciar logs |
| `src/App.tsx` | Modificar | Adicionar rota para a nova página |
| `src/pages/m365/EntraIdPage.tsx` | Modificar | Tornar card de Logs clicável |

## Detalhes Técnicos

### 1. Edge Function: entra-id-audit-logs

Responsabilidades:
- Autenticar o usuário via JWT
- Buscar credenciais do tenant (azure_app_id de m365_app_credentials, client_secret de m365_global_config)
- Obter access_token via Client Credentials flow
- Chamar endpoints do Graph API com filtros

Endpoints do Graph API:
- **Sign-In Logs**: `GET /auditLogs/signIns`
- **Directory Audits**: `GET /auditLogs/directoryAudits`

Parâmetros aceitos:
- `tenant_record_id`: ID do tenant no banco
- `log_type`: 'signIns' ou 'directoryAudits'
- `filter_date_from`: Data inicial (ISO string)
- `filter_date_to`: Data final (ISO string)
- `filter_user`: Email ou UPN do usuário
- `filter_status`: 'success' ou 'failure' (apenas para signIns)
- `top`: Limite de registros (max 100)
- `skip_token`: Token para paginação

### 2. Página EntraIdAuditLogsPage

Layout:
- Header com breadcrumb (Microsoft 365 > Entra ID > Logs de Auditoria)
- Tabs para alternar entre Sign-In Logs e Directory Audits
- Filtros: período, usuário, resultado
- Tabela com colunas específicas por tipo de log

Colunas Sign-In Logs:
- Data/Hora
- Usuário
- Aplicativo
- IP
- Local
- Status (badge: Sucesso/Falha)
- Método de Autenticação

Colunas Directory Audits:
- Data/Hora
- Atividade
- Categoria
- Iniciado por
- Alvo
- Resultado

### 3. Hook useEntraIdAuditLogs

```typescript
interface UseEntraIdAuditLogsOptions {
  tenantRecordId: string;
  logType: 'signIns' | 'directoryAudits';
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    user?: string;
    status?: 'success' | 'failure';
  };
}

interface UseEntraIdAuditLogsResult {
  logs: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}
```

## Fluxo de Dados

```text
1. Usuário acessa /scope-m365/entra-id/audit-logs
   │
2. Página carrega, seleciona primeiro tenant conectado
   │
3. Hook chama edge function com filtros padrão (últimos 7 dias)
   │
4. Edge function:
   ├── Valida JWT do usuário
   ├── Busca azure_app_id de m365_app_credentials
   ├── Busca client_secret de m365_global_config
   ├── Decripta secret
   ├── Obtém access_token do Azure AD
   ├── Chama Graph API com filtros OData
   └── Retorna logs formatados
   │
5. Frontend exibe logs na tabela
   │
6. Usuário pode:
   ├── Alternar tabs (signIns / directoryAudits)
   ├── Aplicar filtros
   └── Paginar (carregar mais)
```

## Considerações de Segurança

- Edge function valida JWT antes de processar
- Verifica se usuário tem acesso ao client do tenant via RLS
- Logs não são armazenados localmente (fetch em tempo real)
- Secrets nunca expostos ao frontend

## Licenciamento Azure AD

Importante: Os logs de auditoria requerem licença Azure AD Premium (P1 ou P2). Se o tenant não tiver a licença, a API retornará erro 403. O frontend deve exibir mensagem apropriada nesse caso.
