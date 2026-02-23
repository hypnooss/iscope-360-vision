

# Fix Config Changes + Documentacao API

## Parte 1: Correcao do Blueprint

Voce esta correto. O filtro `filter=subtype==system` no path `/api/v2/log/memory/event/system/` funciona e ja elimina VPN, wireless e outros subtypes irrelevantes. Os logins que ainda aparecem na saida serao descartados pelo filtro `realChanges` que ja existe no backend (exige `cfgpath` presente, exclui usuarios automaticos/IPs).

### Alteracao no Blueprint (SQL Migration)

Atualizar o step `config_changes` no blueprint `9e33ae45-053c-4ea2-9723-c9e0cf01549c`:

**De:**
```
/api/v2/log/memory/event/system?filter=subtype==config&rows=500
```

**Para:**
```
/api/v2/log/memory/event/system/?filter=subtype==system&rows=500
```

O `rows=500` permanece como limite de seguranca da API (o FortiGate exige esse parametro), mas a filtragem real e feita pelo `filterLogsByTime` no backend que ja descarta tudo fora da ultima hora.

### Backend (Edge Function)

**Nenhuma alteracao necessaria.** O codigo atual em `firewall-analyzer/index.ts` (linhas 579-601) ja possui o filtro `realChanges` que:
- Exige `cfgpath` presente (descarta logins)
- Exclui acoes de sistema (IPsec, tunnel-stats)
- Exclui usuarios automaticos ou IPs
- Filtra apenas acoes de modificacao (add, edit, delete, set, move)

---

## Parte 2: Nova Aba "Documentacao API" no Template

### 2.1 Criar tabela `device_type_api_docs` (SQL Migration)

Campos:
- `id` (uuid, PK)
- `device_type_id` (uuid, FK para device_types)
- `title` (text) -- ex: "Log API - Memory"
- `version` (text) -- ex: "7.4.11"
- `doc_type` (text) -- ex: "log_api", "rest_api", "reference"
- `content` (jsonb) -- o JSON completo do swagger/schema
- `notes` (text, nullable) -- observacoes livres
- `created_by` (uuid, nullable)
- `created_at` / `updated_at` (timestamptz)

RLS: Super admins podem gerenciar tudo; usuarios autenticados podem ler.

### 2.2 Novo componente `ApiDocsManagement.tsx`

Funcionalidades:
- Lista de documentos associados ao template (titulo, versao, tipo, data)
- Upload de novos documentos JSON (dialog com campos: titulo, versao, tipo, arquivo JSON)
- Visualizacao do conteudo (dialog mostrando endpoints/paths do JSON de forma organizada com busca)
- Edicao de titulo/versao/notas
- Exclusao de documentos

### 2.3 Atualizar `TemplateDetailPage.tsx`

- Adicionar nova aba "Documentacao API" com icone `FileText`
- Badge com contador de documentos
- Query para contar docs da tabela `device_type_api_docs`

### 2.4 Inserir o JSON do FortiOS 7.4.11

O arquivo enviado sera inserido como primeiro registro na tabela, associado ao device_type do FortiGate.

---

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| SQL Migration | Criar tabela `device_type_api_docs`, atualizar blueprint path, inserir doc FortiOS 7.4 |
| `src/components/admin/ApiDocsManagement.tsx` | Novo componente |
| `src/pages/admin/TemplateDetailPage.tsx` | Adicionar aba "Documentacao API" |

