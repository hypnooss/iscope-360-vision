
Objetivo
- Atualizar e “profissionalizar” o README.md para refletir o projeto real (iScope 360), deixando claro: o que é, como rodar localmente, como configurar variáveis, como testar e como contribuir.
- Idioma: PT-BR.
- Público-alvo: equilibrado (dev + operação).
- Detalhe sobre backend: somente o necessário para o frontend (mencionar que existe Supabase/Edge Functions e apontar para docs/migration).

O que encontrei no projeto (rápido diagnóstico)
- README.md atual é o template padrão do Lovable, com placeholders (REPLACE_WITH_PROJECT_ID) e sem descrição do iScope 360.
- Stack: Vite + React + TypeScript + Tailwind + shadcn-ui; TanStack Query; Supabase JS v2; React Router.
- Há um conjunto grande de módulos/rotas no frontend, incluindo:
  - Dashboard geral (/dashboard)
  - Scope Firewall (/scope-firewall/*)
  - Scope External Domain (/scope-external-domain/*)
  - Scope M365 (/scope-m365/*)
  - Admin/Usuários/Agents/Workspaces (/users, /agents, /workspaces, etc.)
- Variáveis de ambiente relevantes para o frontend já existem no .env:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_PUBLISHABLE_KEY
  - VITE_SUPABASE_PROJECT_ID
- Existe documentação de migração e setup (docs/migration/*), e um python-agent com README próprio (python-agent/README.md). Como você pediu “somente frontend”, isso deve virar apenas referência no README principal (não duplicar).

Mudanças propostas no README.md (estrutura final sugerida)
1) Título e descrição
- “# iScope 360”
- 2–4 linhas explicando o propósito (plataforma de análise/observabilidade/compliance de infraestrutura) alinhado com o texto do Index (“Gerencie sua Infraestrutura com Inteligência”).
- Opcional: um “Status” curto (ex.: “Em desenvolvimento / Preview”).

2) Links do projeto
- Incluir:
  - Preview URL (do seu projeto Lovable)
  - Published URL (quando existir)
  - (Opcional) Link do Supabase (apenas referência, sem credenciais)
- Remover placeholders “REPLACE_WITH_PROJECT_ID”.

3) Principais funcionalidades (visão de produto, alto nível)
- Lista curta (bullets) com os módulos já existentes no código:
  - Dashboard geral
  - Firewall (compliance, análises, relatórios, execuções)
  - External Domain (análises, relatórios, execuções)
  - Microsoft 365 / Entra ID (conexão tenant, auditoria, análise)
  - Gestão de usuários, administradores, agents, workspaces
- Sem prometer coisas que não existem; usar linguagem “inclui telas/fluxos para…”.

4) Tecnologias
- Manter, mas atualizar para refletir o repo:
  - Vite, React 18, TypeScript, Tailwind, shadcn-ui/Radix
  - React Router
  - TanStack Query
  - Supabase (Auth + Database via @supabase/supabase-js)
  - Playwright (teste E2E — está em dependências)

5) Como rodar localmente (passo a passo)
- Pré-requisitos:
  - Node.js (sugerir LTS) e npm
- Instalação e execução:
  - npm i
  - npm run dev
- Outros scripts (do package.json):
  - npm run build
  - npm run preview
  - npm run lint

6) Variáveis de ambiente (frontend)
- Explicar que o projeto usa Supabase no frontend e precisa das variáveis VITE_*.
- Instruir como criar um .env local (ou usar o já existente) sem expor chaves no README:
  - Exemplo com placeholders, tipo:
    - VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
    - VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
    - VITE_SUPABASE_PROJECT_ID="<project-ref>"
- Nota de segurança: não commitar service_role key no frontend; somente anon key no client.

7) Rotas principais (para orientar QA/operação)
- Listar rotas principais que existem em src/App.tsx, agrupadas por módulo.
- Isso ajuda quem testa a navegar rapidamente.

8) Backend (apenas referência, como você pediu)
- Seção curta: “Backend e Supabase”
  - “Este repositório já está preparado para Supabase…”
  - Linkar para:
    - docs/migration/migration_guide.md (migração)
    - python-agent/README.md (agent)
  - Não colocar tutorial detalhado de Edge Functions aqui (porque você pediu “Somente frontend”).

9) Testes (rápido)
- Como há Playwright instalado, incluir:
  - Onde ficam os testes (se existirem; se não existirem ainda, mencionar “Playwright está configurado e pode ser usado para E2E”).
- Se eu não encontrar testes existentes ao revisar, vou escrever a seção de forma honesta (sem inventar comando “npm run test” se não existe script).

10) Contribuição e padrão de commits (opcional)
- Seção curta para time:
  - Branches, PRs, lint antes de commitar
  - Observação: mudanças feitas via Lovable também commitam no repo (se estiver integrado ao GitHub)

11) Licença / aviso legal (opcional)
- Se você tiver uma licença definida, incluir; se não tiver, deixar uma linha “Licença: a definir”.

Trabalho de verificação antes de escrever (para evitar README “mentiroso”)
- Conferir se existe pasta de testes Playwright e/ou scripts adicionais (playwright.config.ts, e2e specs).
- Conferir se há instruções específicas de build (vite.config.ts) relevantes.
- Confirmar se existe alguma configuração obrigatória adicional no frontend (ex.: redirect de auth, callback URL).

Critérios de aceite (o que você vai validar)
- README está em PT-BR e menciona “iScope 360”.
- Não há placeholders antigos de URL.
- README explica claramente como rodar localmente e quais env vars são necessárias (sem expor segredos).
- README descreve os módulos/rotas que realmente existem no projeto.
- README aponta para docs/migration e python-agent sem duplicar conteúdo.

Próximo passo (após sua aprovação)
- Eu vou revisar rapidamente os arquivos de configuração de testes (Playwright) e, em seguida, reescrever o README.md completo seguindo a estrutura acima, mantendo o texto objetivo e copiável (com blocos de comando prontos).
