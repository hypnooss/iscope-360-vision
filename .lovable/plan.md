
## Objetivo
Trazer (“puxar”) todos os arquivos do seu repositório GitHub para este projeto Lovable, substituindo o código atual pelo código que está no GitHub, de forma segura e verificável.

## O que é possível fazer no Lovable (importante)
- O Lovable tem integração com GitHub para **sincronizar** o código do projeto com um repositório GitHub.
- Na prática, para “puxar todos os arquivos de um repo existente para dentro do projeto”, o caminho mais confiável é:
  1) **conectar o projeto Lovable ao GitHub**, e
  2) **enviar (push)** o conteúdo do seu repositório existente para o repositório que o Lovable usa para sincronizar.
  
Isso faz o Lovable receber exatamente os arquivos do GitHub via sync (equivalente a “puxar tudo”).

## Pré-requisitos (para não perder nada)
1) Você precisa ter o **link do repositório GitHub** que contém os arquivos (ex.: `https://github.com/sua-org/seu-repo`).
2) Você confirmou que:
   - é um **repo existente**
   - pode **autorizar o app do Lovable**
   - quer **substituir** o código atual pelo do GitHub

## Plano de execução (alto nível)
### Fase 1 — Preparação e segurança (evitar perda de código)
1) Confirmar se este projeto Lovable já está conectado a algum GitHub:
   - Se já estiver, vamos identificar qual repo ele está usando.
2) Criar um “backup” do estado atual (para reverter se algo der errado):
   - Opção A: criar um commit/tag/branch de backup no repo conectado.
   - Opção B: duplicar (remix) o projeto no Lovable antes de sobrescrever (backup visual do projeto).

### Fase 2 — Conectar o projeto ao GitHub (se ainda não estiver)
3) No Lovable: **Project Settings → GitHub → Connect project**
4) Autorizar o Lovable GitHub App e escolher a conta/org.
5) Escolher a opção que o Lovable oferece (normalmente “Create repository” para o projeto).
   - Resultado: teremos um repositório “repo-do-lovable” que representa este projeto.

### Fase 3 — Substituir o conteúdo pelo seu repo existente (o “pull” real)
6) No seu computador (ou GitHub Codespaces):
   - Clonar o seu repo existente (fonte):
     ```sh
     git clone <URL_DO_REPO_EXISTENTE>
     ```
   - Clonar o repo criado/conectado pelo Lovable (destino):
     ```sh
     git clone <URL_DO_REPO_DO_LOVABLE>
     ```
7) Copiar todo o conteúdo do repo existente para o repo do Lovable (destino), e sobrescrever arquivos:
   - Copiar pastas principais (`src/`, `public/`, configs, etc.).
   - Atenção especial para não carregar secrets (ex.: `.env`), e para manter/ajustar arquivos específicos do Lovable se necessário.
8) Fazer commit e push no repo do Lovable:
   ```sh
   git add -A
   git commit -m "Sync: import code from existing GitHub repo"
   git push
   ```
9) Aguardar o sync: o Lovable deve “puxar” essas mudanças automaticamente (bidirectional sync).

### Fase 4 — Validação no Preview
10) Abrir o Preview do Lovable e checar:
   - Página inicial carrega sem tela branca
   - Console sem erros críticos
   - Rotas principais funcionando
11) Se houver erros de build por diferenças de dependências:
   - Ajustar `package.json` para bater com o repo importado
   - Conferir `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, etc.

### Fase 5 — Ajustes comuns pós-import (checklist)
12) Conferir integrações Supabase:
   - `src/integrations/supabase/client.ts` pode precisar bater com o novo repo (URL/anon key costumam vir do ambiente do Lovable; não devem ficar hardcoded).
   - Edge functions e `supabase/config.toml` devem ser compatíveis com o projeto “iScope” já conectado.
13) Conferir assets/branding:
   - Logo, favicon, título (`index.html`) e rotas em `src/App.tsx`.

## Pontos de atenção / riscos
- “Overwrite with GitHub” vai substituir o código atual: por isso a Fase 1 (backup) é essencial.
- Se seu repo existente tiver bibliotecas diferentes (ex.: outra versão do React/Vite), pode quebrar o build até alinhar dependências.
- Arquivos de segredo (`.env`, tokens) não devem ser commitados; no Lovable/Supabase o ideal é usar Secrets/Env do ambiente.

## O que eu preciso de você para executar perfeitamente
1) O link do repositório GitHub existente (URL).
2) Confirmar se quer importar a branch:
   - `main` (mais comum) ou outra (ex.: `develop`)?
3) Se o repo existente já tem Supabase/Edge Functions próprios, confirmar se devemos:
   - manter as funções atuais do Lovable e adaptar, ou
   - substituir também as funções do `supabase/functions/`.

## Critério de pronto (Definition of Done)
- O código do GitHub está presente no projeto Lovable (via sync).
- O Preview abre sem erros críticos.
- Navegação principal funciona e as integrações essenciais (Supabase/rotas) estão estáveis.
- Existe um caminho claro de rollback (branch/tag ou remix) caso precise reverter.
