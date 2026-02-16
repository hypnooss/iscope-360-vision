

# Integrar DeHashed API no Surface Analyzer (Credenciais Vazadas)

## Visao Geral

Adicionar uma nova secao ao **Dominio Externo > Analyzer** que exibe credenciais vazadas associadas ao dominio do workspace, consultando a API do DeHashed. A secao aparecera como um novo bloco na pagina do Analyzer, seguindo o mesmo padrao visual (TimelineSection, glass-card, badges de severidade).

## Sobre a API do DeHashed

- **Endpoint**: `GET https://api.dehashed.com/search?query=domain:{dominio}`
- **Autenticacao**: Basic Auth (`email:api_key`)
- **Header**: `Accept: application/json`
- **Resposta**: Lista de "entries" contendo `email`, `password`, `hashed_password`, `username`, `database_name`, `ip_address`, etc.
- **Creditos**: Cada busca por dominio consome 2 creditos
- **Sem verificacao de dominio**: Diferente do HIBP, nao exige verificacao previa

## Requisitos Previos

O usuario precisara:
1. Criar conta em dehashed.com e assinar um plano (a partir de ~$4/mes)
2. Obter o email da conta + API Key
3. Cadastrar `DEHASHED_API_KEY` e `DEHASHED_EMAIL` nas configuracoes (via Settings > API Keys)

## Implementacao

### 1. Edge Function: `dehashed-search`

Novo arquivo `supabase/functions/dehashed-search/index.ts`:
- Recebe `domain` no body (POST)
- Valida autenticacao do usuario (JWT)
- Busca as credenciais `DEHASHED_API_KEY` e `DEHASHED_EMAIL` em `system_settings` (padrao criptografado existente) com fallback para env vars
- Chama `https://api.dehashed.com/search?query=domain:{domain}&size=10000` com Basic Auth
- Retorna os dados filtrados: email, password (mascarada), hashed_password, database_name, username
- As senhas em texto claro serao parcialmente mascaradas (ex: `Pas****`) por seguranca
- Paginacao: a API retorna ate 10000 por pagina; faz multiplas chamadas se necessario

### 2. Tabela: `dehashed_cache`

Cache dos resultados para evitar consumo excessivo de creditos:
- `id` (uuid PK)
- `client_id` (uuid FK clients)
- `domain` (text)
- `total_entries` (integer)
- `entries` (jsonb) - lista de credenciais encontradas
- `databases` (jsonb) - lista de breaches/databases unicos
- `queried_at` (timestamptz)
- `created_at` (timestamptz)
- RLS: acesso baseado em `has_client_access`

### 3. Registrar DeHashed nas API Keys Gerenciaveis

Atualizar `supabase/functions/manage-api-keys/index.ts`:
- Adicionar `DEHASHED_API_KEY` e `DEHASHED_EMAIL` ao array `MANAGED_KEYS`
- Isso permite que os admins cadastrem as credenciais via Settings > API Keys

### 4. Componente: Secao de Credenciais Vazadas no Analyzer

Na pagina `AttackSurfaceAnalyzerPage.tsx`, adicionar uma nova `TimelineSection` (apos os stats cards e antes da lista de assets) com:

- **Stat cards**: Total de credenciais vazadas, Senhas em texto claro, Breaches unicos, Emails unicos
- **Tabela expansivel**: lista de emails/usernames com senha (mascarada), hash, e nome do breach/database
- **Filtro**: busca por email/username
- **Botao "Consultar DeHashed"** (visivel para super_admin): dispara a consulta sob demanda
- **Cache**: usa dados do cache se existirem (com indicacao de "ultima consulta em X")
- Se nao houver API key configurada, exibe mensagem orientando configurar em Settings

### 5. Configuracao TOML

Adicionar ao `supabase/config.toml`:
```toml
[functions.dehashed-search]
verify_jwt = false
```

## Detalhes Tecnicos

### Formato da resposta do DeHashed (campos relevantes por entry):
```text
email, username, password, hashed_password, ip_address, 
name, phone, address, database_name
```

### Mascaramento de senhas:
- Senhas em texto claro: mostrar apenas primeiros 3 caracteres + asteriscos (ex: `Pas*****`)
- Hashes: exibir tipo + primeiros 8 chars (ex: `bcrypt: $2b$10$X...`)
- Opcao para super_admin revelar senha completa (toggle)

### Fluxo na UI:
1. Pagina carrega -> busca cache do dominio do workspace em `dehashed_cache`
2. Se cache existe e tem menos de 7 dias -> exibe dados do cache
3. Se nao existe ou expirado -> exibe "Nenhuma consulta realizada" com botao para consultar
4. Ao clicar "Consultar" -> chama edge function -> salva no cache -> exibe resultados

### Arquivos criados/modificados:
- **Criar**: `supabase/functions/dehashed-search/index.ts`
- **Modificar**: `supabase/functions/manage-api-keys/index.ts` (adicionar DEHASHED_API_KEY e DEHASHED_EMAIL)
- **Modificar**: `supabase/config.toml` (adicionar funcao)
- **Modificar**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (adicionar secao de leaked credentials)
- **Criar**: Migration SQL para tabela `dehashed_cache`

