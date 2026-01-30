# iScope 360

Plataforma web para análise de **compliance**, **segurança** e **boas práticas** em infraestrutura (rede, domínios externos e Microsoft 365), com dashboards, relatórios e fluxos de gestão.

> Status: em desenvolvimento (Preview)

## Links

- **Preview (Lovable):** https://id-preview--d760b909-6da2-4037-9fd2-c67de04113d1.lovable.app
- **Publicado:** (ainda não publicado)

## Principais funcionalidades (alto nível)

- **Dashboard geral** para visão consolidada.
- **Scope Firewall**: cadastro de firewalls, análises, execuções e relatórios.
- **Scope External Domain**: cadastro de domínios, análises, execuções e relatórios.
- **Scope M365 / Entra ID**: conexão de tenant, auditoria e páginas de análise.
- **Administração**: gestão de usuários, administradores, agentes e workspaces.

> Observação: esta lista reflete as rotas/telas existentes no frontend (veja “Rotas principais”).

## Tecnologias

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **React Router** (roteamento)
- **TanStack Query** (cache/requests)
- **Supabase JS v2** (integração no frontend)
- **Playwright** (E2E – base configurada)

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

## Rotas principais (atalhos para QA/operação)

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

- `/scope-m365/dashboard`
- `/scope-m365/tenant-connection`
- `/scope-m365/oauth-callback`
- `/scope-m365/entra-id`
- `/scope-m365/entra-id/audit-logs`
- `/scope-m365/entra-id/analysis`

### Admin

- `/users`
- `/agents`
- `/workspaces` (rota recomendada)
- `/administrators`
- `/settings`
- `/collections`

## Backend (referência — somente o necessário para o frontend)

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

Licença: a definir.
