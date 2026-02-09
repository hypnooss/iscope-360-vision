# iScope 360

Plataforma web para análise de **compliance**, **segurança** e **boas práticas** em infraestrutura (firewalls, domínios externos e Microsoft 365), com dashboards, relatórios PDF, execuções unificadas e gestão multi-tenant.

> Status: em desenvolvimento (Preview)

## Links

- **Preview (Lovable):** https://id-preview--d760b909-6da2-4037-9fd2-c67de04113d1.lovable.app
- **Publicado:** (ainda não publicado)

## Principais funcionalidades

### Scope Firewall
- Cadastro de firewalls com suporte a múltiplos device types (FortiGate, etc.)
- Análise de compliance baseada em blueprints e regras configuráveis
- Verificação de CVEs no firmware
- Dashboard com score, categorias e tendências
- Execuções via agent com upload progressivo de steps
- Relatórios PDF com score gauge, categorias e plano de ação

### Scope External Domain
- Cadastro de domínios externos vinculados a workspaces
- Análise automatizada: DNS, subdomínios (Amass), SPF, DMARC, DKIM, DNSSEC
- Mapa DNS visual
- Relatórios PDF com score, categorias e recomendações

### Scope Microsoft 365
- **Conexão de tenant**: OAuth 2.0 com consentimento admin, suporte multi-tenant
- **Postura de segurança**: Análise via Microsoft Graph API com score consolidado, categorias (Identity, Data, Device, App, Infrastructure) e breakdown por severidade
- **Entra ID — Security Insights**: Análise de configurações de segurança do Entra ID
- **Entra ID — Application Insights**: Inventário e análise de App Registrations e Enterprise Apps
- **Exchange Online**: Análise via PowerShell (Exchange Online Management) com autenticação CBA
- **Execuções unificadas**: Tabela única combinando análises de postura (API/Edge Function) e tasks PowerShell do agent, com colunas padronizadas (Tenant, Agent, Tipo, Status, Duração, Criado em, Ações)
- **Relatórios PDF**: Postura M365 com score gauge, categorias, entidades afetadas e remediações

### Administração
- **Workspaces**: Gestão de clientes/workspaces com isolamento de dados
- **Usuários**: Convite, permissões por módulo (view/manage), roles (super_admin, workspace_admin, user)
- **Administradores**: Gestão de super admins e workspace admins
- **Agents**: Cadastro, ativação por código, monitoramento (heartbeat, versão, capabilities), detalhes por agent
- **Templates**: Blueprints de coleta e regras de compliance por device type, com visualização de fluxo
- **Configurações**: Configuração global do app M365 (app_id, client_secret), permissões requeridas
- **Preview Mode**: Admins podem visualizar a plataforma como um usuário específico

## Tecnologias

### Frontend
- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **React Router** (roteamento com lazy loading)
- **TanStack Query** (cache/requests)
- **@react-pdf/renderer** (geração de PDFs no client)
- **Recharts** (gráficos e dashboards)
- **Framer Motion** via Tailwind (animações)
- **Supabase JS v2** (integração frontend)

### Backend
- **Supabase** (PostgreSQL, Auth, RLS, Edge Functions)
- **Edge Functions** (Deno): análises de postura, compliance, integração Microsoft Graph API
- **Python Agent**: coleta local em servidores (firewalls, SSH, SNMP, DNS, PowerShell M365)

### Testes
- **Playwright** (E2E — base configurada)

## Como rodar localmente

### Pré-requisitos

- Node.js **LTS** (recomendado) + npm

### Instalação

```bash
npm i
```

### Ambiente de desenvolvimento

```bash
npm run dev
```

### Outros scripts úteis

```bash
npm run build
npm run build:dev
npm run preview
npm run lint
```

## Variáveis de ambiente (frontend)

O frontend usa Supabase via variáveis `VITE_*`.

Crie um arquivo **.env** (ou ajuste o existente) com:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

### Nota de segurança

- **Nunca** coloque `service_role` no frontend.
- No client, use apenas a **anon key/publishable**.

## Rotas principais

Rotas definidas em `src/App.tsx`:

### Públicas

- `/` (landing)
- `/auth` (autenticação)

### Seleção de módulo e dashboard

- `/modules`
- `/dashboard`

### Scope Firewall

- `/scope-firewall/dashboard`
- `/scope-firewall/firewalls`
- `/scope-firewall/firewalls/:id/analysis`
- `/scope-firewall/executions`
- `/scope-firewall/reports`

### Scope External Domain

- `/scope-external-domain/domains`
- `/scope-external-domain/executions`
- `/scope-external-domain/reports`
- `/scope-external-domain/domains/:id/report/:analysisId`

### Scope M365

- `/scope-m365/tenant-connection`
- `/scope-m365/oauth-callback`
- `/scope-m365/posture`
- `/scope-m365/posture/report/:reportId`
- `/scope-m365/entra-id`
- `/scope-m365/entra-id/security-insights`
- `/scope-m365/entra-id/applications`
- `/scope-m365/entra-id/analysis`
- `/scope-m365/exchange-online`
- `/scope-m365/executions`
- `/scope-m365/reports`

### Admin

- `/users`
- `/agents`
- `/agents/:id`
- `/workspaces`
- `/administrators`
- `/settings`
- `/templates`
- `/templates/:id`

### Preview (temporário)

- `/preview/domain-report`
- `/preview/firewall-report`

## Backend (referência)

Este repositório inclui integrações com Supabase e Edge Functions, mas o setup detalhado do backend fica referenciado em:

- Migração/estrutura: `docs/migration/migration_guide.md`
- Agent (Python): `python-agent/README.md`

## Testes (E2E)

O projeto tem Playwright instalado e `playwright.config.ts` configurado.

- Coloque specs E2E em `e2e/` (pasta padrão; crie se ainda não existir).
- Execução local (exemplo):

```bash
npx playwright test
```

## Contribuição (rápido)

- Rode `npm run lint` antes de abrir PR.
- Prefira PRs pequenos e descritivos.
- Mudanças feitas via **Lovable** podem ser commitadas automaticamente no repositório quando integrado.

## Licença

Proprietário — iScope 360 © 2024-2025
