

## Plano: Aba "API iScope" na area de Configuracoes

### Contexto

A aba existente "Chaves de API" gerencia keys de terceiros (VirusTotal, Shodan, etc.). A nova aba "API iScope" e diferente: gerencia chaves de acesso para que **projetos externos** consumam dados do iSCOPE via API.

### Estrutura do banco (nova migration)

**Tabela `api_access_keys`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| client_id | uuid FK clients | Workspace associado |
| key_hash | text | SHA-256 do token (nunca armazena plaintext) |
| key_prefix | text | Primeiros 8 chars para identificacao visual |
| name | text | Nome descritivo (ex: "Integracao SOC") |
| scopes | text[] | Permissoes: `external_domain:read`, `external_domain:analyze`, etc. |
| is_active | boolean | Ativo/revogado |
| expires_at | timestamptz | Expiracao opcional |
| last_used_at | timestamptz | Ultimo uso |
| created_by | uuid FK auth.users | Quem criou |
| created_at / updated_at | timestamptz | Timestamps |

**Tabela `api_access_logs`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| api_key_id | uuid FK | Key usada |
| endpoint | text | Endpoint chamado |
| method | text | GET/POST |
| status_code | int | Response status |
| ip_address | text | IP de origem |
| created_at | timestamptz | Timestamp |

**RLS**: Apenas `super_admin` e `super_suporte` podem gerenciar keys. Logs sao read-only para admins.

**Scopes disponiveis (fase 1 — dominio externo)**:
- `external_domain:read` — listar dominios e status
- `external_domain:report` — obter relatorio de analise
- `external_domain:analyze` — disparar nova analise
- `external_domain:subdomains` — listar subdominios
- `external_domain:certificates` — dados de certificados

### Edge Function: `api-access-keys`

Gerencia CRUD das API keys:
- **POST /generate** — gera token UUID v4, armazena hash SHA-256, retorna token plaintext **uma unica vez**
- **GET /list** — lista keys com prefix, nome, scopes, status, ultimo uso
- **POST /revoke** — desativa uma key
- **POST /update** — atualiza nome, scopes, expiracao
- **DELETE** — remove permanentemente

### Edge Function: `api-gateway` (futura, base minima agora)

Endpoint publico que valida API key e roteia para os dados:
- Recebe header `X-API-Key`
- Faz hash SHA-256 e busca na tabela
- Valida scopes vs endpoint solicitado
- Registra log de acesso
- Rotas fase 1:
  - `GET /v1/domains` — lista dominios do workspace
  - `GET /v1/domains/:id/report` — ultimo relatorio
  - `POST /v1/domains/:id/analyze` — trigger analise

### Frontend: Nova aba "API iScope"

Adicionada ao `SettingsPage.tsx` com icone `Globe` ou `Plug`:

**Secao 1 — Gerar Nova Chave**
- Formulario: nome, workspace, scopes (checkboxes), expiracao opcional
- Ao gerar, modal exibe o token completo com aviso "copie agora, nao sera exibido novamente"
- Botao copiar para clipboard

**Secao 2 — Chaves Existentes**
- Tabela com: nome, prefix (`isk_a1b2c3d4...`), scopes (badges), status, ultimo uso, criado em
- Acoes: editar scopes/nome, revogar, excluir
- Filtro por status (ativa/revogada)

**Secao 3 — Documentacao Rapida**
- Card com exemplos de uso (curl) para cada endpoint disponivel
- Mostra base URL e headers necessarios

**Secao 4 — Logs de Acesso** (acordeao ou sub-tab)
- Ultimas 100 chamadas com endpoint, status, IP, timestamp
- Filtro por key

### Componentes novos

```text
src/components/admin/
  ApiAccessManagement.tsx      — componente principal da aba
  ApiKeyGenerateDialog.tsx     — modal de geracao com exibicao do token
  ApiKeyScopesSelect.tsx       — checkboxes de scopes com descricoes
  ApiAccessLogsTable.tsx       — tabela de logs de acesso
```

### Alteracoes em arquivos existentes

- `SettingsPage.tsx` — adicionar nova tab "API iScope" com o componente `ApiAccessManagement`
- `manage-api-keys/index.ts` — nenhuma alteracao (continua gerenciando keys de terceiros)

### Fluxo de seguranca

1. Token gerado como UUID v4 com prefixo `isk_`
2. Armazena apenas SHA-256 no banco
3. Na validacao (api-gateway), faz hash do token recebido e compara
4. Rate limiting por key (100 req/min padrao)
5. Logs de todas as chamadas para auditoria

### Ordem de implementacao

1. Migration com tabelas e RLS
2. Edge function `api-access-keys` (CRUD)
3. Componentes frontend (aba completa)
4. Edge function `api-gateway` (validacao + rotas basicas dominio externo)

