

# Integrar Have I Been Pwned (HIBP) para Credenciais Vazadas

## Resumo

Substituir a integração DeHashed pela API v3 do HIBP usando o endpoint `GET /api/v3/breacheddomain/{domain}`. Voce ja tem acesso para registrar dominios no painel do HIBP, e a mesma API key que voce ja usa para buscar emails funciona para domain search.

## Pre-requisitos do usuario

1. Ter uma **API key do HIBP** (comprada em haveibeenpwned.com/API/Key)
2. Registrar o dominio no **Domain Search Dashboard** do HIBP (verificacao por DNS TXT ou meta tag)
3. Cadastrar a chave como `HIBP_API_KEY` em Settings > API Keys

## Como funciona a API

- **Endpoint**: `GET https://haveibeenpwned.com/api/v3/breacheddomain/{domain}`
- **Header**: `hibp-api-key: {sua_key}`
- **Resposta**: Mapa de aliases (parte local do email) para lista de breaches:
```text
{
  "joao": ["Adobe", "LinkedIn"],
  "maria": ["Dropbox"]
}
```
- Nota: a API retorna apenas o **alias** (parte antes do @) e os **nomes dos breaches**, sem senhas ou hashes

## Alteracoes

### 1. Nova Edge Function ou adaptar a existente

**Arquivo**: `supabase/functions/dehashed-search/index.ts`

- Renomear internamente a logica para chamar HIBP em vez de DeHashed
- Buscar `HIBP_API_KEY` de `system_settings` (mesmo padrao das outras chaves)
- Chamar `GET https://haveibeenpwned.com/api/v3/breacheddomain/{domain}` com header `hibp-api-key`
- Transformar a resposta (alias -> breaches) em entries com formato `email = alias@domain`, `database_name = breach name`
- Campos de senha ficam vazios (HIBP nao retorna senhas)
- Continuar salvando no cache `dehashed_cache` com a mesma estrutura

### 2. Atualizar manage-api-keys

**Arquivo**: `supabase/functions/manage-api-keys/index.ts`

- Substituir as entradas `DEHASHED_API_KEY` e `DEHASHED_EMAIL` por uma unica entrada `HIBP_API_KEY` com label "Have I Been Pwned" e descricao adequada

### 3. Atualizar o componente de UI

**Arquivo**: `src/components/external-domain/LeakedCredentialsSection.tsx`

- Titulo: "Credenciais Vazadas (HIBP)" em vez de "(DeHashed)"
- Labels dos botoes: "Consultar HIBP"
- Remover coluna "Senha" e "Hash" da tabela (HIBP nao fornece essas infos)
- Remover toggle "Revelar Senhas"
- Stat card "Senhas em Texto Claro" substituido por outro relevante (ex: "Total Breaches" global)
- Mensagem de API key: mencionar `HIBP_API_KEY`

### 4. Reativar o componente na pagina

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

- Descomentar o import do `LeakedCredentialsSection`
- Restaurar a renderizacao do componente

## Limitacao importante

O HIBP **nao retorna senhas nem hashes** -- apenas quais breaches afetaram cada alias do dominio. Isso e uma diferenca significativa em relacao ao DeHashed. O valor esta em saber **quais usuarios foram comprometidos** e em **quais breaches**, permitindo acoes como forcar troca de senha.

## Sequencia de implementacao

1. Adicionar `HIBP_API_KEY` ao `manage-api-keys`
2. Reescrever a edge function `dehashed-search` para usar HIBP
3. Atualizar o componente `LeakedCredentialsSection`
4. Reativar o componente no `AttackSurfaceAnalyzerPage`

