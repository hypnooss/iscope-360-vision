
# Plano: Refatorar Modal de Detalhes do Agent para Pagina Dedicada

## Resumo

O modal atual de detalhes do agent esta sobrecarregado com muitas informacoes. Este plano cria uma pagina dedicada `/agents/:id` que oferece mais espaco para exibir todas as informacoes do agent, incluindo dados de certificado M365 que atualmente nao sao visiveis.

---

## Arquitetura da Pagina

```text
+-------------------------------------------------------+
|  Breadcrumb: Agents > [Nome do Agent]                 |
+-------------------------------------------------------+
|                                                       |
|  +------------------+  +----------------------------+ |
|  |   Status Card    |  |    Informacoes Gerais     | |
|  |   - Online/Off   |  |    - Nome, Cliente        | |
|  |   - Versao       |  |    - Criado em, Last seen | |
|  |                  |  |    - Agent ID             | |
|  +------------------+  +----------------------------+ |
|                                                       |
|  +--------------------------------------------------+ |
|  |              Certificado M365                    | |
|  |  - Thumbprint                                    | |
|  |  - Azure Key ID (se registrado)                  | |
|  |  - Status do registro                            | |
|  |  - Botao baixar certificado publico              | |
|  +--------------------------------------------------+ |
|                                                       |
|  +--------------------------------------------------+ |
|  |              Capabilities                        | |
|  |  [Tag1] [Tag2] [Tag3]                           | |
|  +--------------------------------------------------+ |
|                                                       |
|  +--------------------------------------------------+ |
|  |           Codigo de Ativacao                     | |
|  |  - Codigo atual (se existir)                     | |
|  |  - Botao gerar novo codigo                       | |
|  |  - Instrucoes de instalacao                      | |
|  +--------------------------------------------------+ |
|                                                       |
|  +--------------------------------------------------+ |
|  |              Acoes                               | |
|  |  [Verificar Componentes] [Revogar] [Deletar]    | |
|  +--------------------------------------------------+ |
|                                                       |
+-------------------------------------------------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/AgentDetailPage.tsx` | **NOVO** | Pagina de detalhes do agent |
| `src/App.tsx` | Modificar | Adicionar rota `/agents/:id` |
| `src/pages/AgentsPage.tsx` | Modificar | Alterar botao Eye para navegar em vez de abrir modal |

---

## Implementacao Detalhada

### 1. Nova Pagina: `src/pages/AgentDetailPage.tsx`

Estrutura da pagina:

```tsx
export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch agent data with all certificate fields
  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select(`
          *,
          clients!client_id(name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });
  
  // ... restante da implementacao
}
```

### 2. Secoes da Pagina

**Header com Breadcrumb e Acoes**
- Breadcrumb: Agents > [Nome]
- Botao Voltar
- Status badge (Online/Offline/Revogado)

**Card de Status**
- Status visual grande
- Versao do agent
- Ultimo heartbeat

**Card de Informacoes Gerais**
- Nome
- Cliente associado
- Data de criacao
- Agent ID (copiavel)

**Card de Certificado M365** (NOVA SECAO)
- Thumbprint do certificado
- Chave publica (botao download)
- Azure Key ID (se registrado no Azure)
- Status do registro:
  - "Pendente" - tem certificado mas nao tem azure_key_id
  - "Registrado" - tem azure_key_id
  - "Sem certificado" - nenhum certificado gerado

**Card de Capabilities**
- Lista de capabilities como badges
- Ex: `http_request`, `ssh`, `m365_powershell`, etc.

**Card de Codigo de Ativacao**
- Codigo atual (se pendente)
- Botao gerar novo codigo
- Instrucoes de instalacao (componente existente)

**Card de Acoes**
- Verificar Componentes
- Revogar Agent
- Deletar Agent (so se revogado)

### 3. Modificar App.tsx

Adicionar nova rota:

```tsx
// Lazy load
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));

// Na secao de rotas
<Route path="/agents/:id" element={<AgentDetailPage />} />
```

### 4. Modificar AgentsPage.tsx

Alterar botao de detalhes para navegar:

```tsx
// Antes
<Button onClick={() => handleViewDetails(agent)}>
  <Eye className="w-4 h-4" />
</Button>

// Depois
<Button onClick={() => navigate(`/agents/${agent.id}`)}>
  <Eye className="w-4 h-4" />
</Button>
```

Remover:
- Estado `detailsDialogOpen`
- Estado `selectedAgent`
- Funcao `handleViewDetails`
- Dialog de detalhes (todo o bloco)
- Estados relacionados: `newActivationCode`, `generatingCode`, `checkingComponents`

Manter os dialogs que sao usados de forma independente:
- `AlertDialog` de revogacao
- `Dialog` de delecao

---

## Campos do Agent a Exibir

| Campo | Localizacao na Pagina | Notas |
|-------|----------------------|-------|
| `name` | Header + Info | Nome do agent |
| `id` | Info | UUID copiavel |
| `client_id` / `client_name` | Info | Cliente associado |
| `created_at` | Info | Data de criacao |
| `last_seen` | Status | Ultimo heartbeat |
| `agent_version` | Status | Versao instalada |
| `revoked` | Status | Badge de status |
| `capabilities` | Capabilities | Array de strings |
| `certificate_thumbprint` | Certificado | Thumbprint SHA-1 |
| `certificate_public_key` | Certificado | PEM (download) |
| `azure_certificate_key_id` | Certificado | ID no Azure AD |
| `activation_code` | Ativacao | Codigo pendente |
| `activation_code_expires_at` | Ativacao | Expiracao |
| `check_components` | Acoes | Flag de verificacao |

---

## Design Visual

- Layout responsivo com grid 2 colunas em desktop, 1 coluna em mobile
- Cards com estilo `glass-card` existente
- Badges coloridos para status e capabilities
- Icones consistentes com resto do sistema
- Botoes de acao com confirmacao (AlertDialog)

---

## Fluxo de Navegacao

```text
/agents
  |
  +-- Click Eye icon --> /agents/:id (AgentDetailPage)
  |                        |
  |                        +-- Click Voltar --> /agents
  |                        |
  |                        +-- Revogar --> AlertDialog --> /agents
  |                        |
  |                        +-- Deletar --> Dialog --> /agents
  |
  +-- Click Bot icon --> Dialog (instrucoes - manter)
  |
  +-- Click Ban icon --> AlertDialog (revogar - manter)
```

---

## Secao Tecnica

### Query do Agent com Join

```sql
SELECT 
  agents.*,
  clients.name as client_name
FROM agents
LEFT JOIN clients ON agents.client_id = clients.id
WHERE agents.id = :id
```

No Supabase:

```typescript
const { data } = await supabase
  .from('agents')
  .select('*, clients!client_id(name)')
  .eq('id', id)
  .single();
```

### Download do Certificado Publico

```typescript
const downloadCertificate = () => {
  if (!agent?.certificate_public_key) return;
  
  const blob = new Blob([agent.certificate_public_key], { 
    type: 'application/x-pem-file' 
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agent.name.replace(/\s+/g, '-')}-cert.pem`;
  link.click();
  URL.revokeObjectURL(url);
};
```

### Tipo Agent Atualizado

```typescript
interface Agent {
  id: string;
  name: string;
  client_id: string | null;
  created_at: string;
  last_seen: string | null;
  revoked: boolean;
  activation_code: string | null;
  activation_code_expires_at: string | null;
  agent_version: string | null;
  capabilities: string[] | null;
  certificate_thumbprint: string | null;
  certificate_public_key: string | null;
  azure_certificate_key_id: string | null;
  check_components: boolean;
  clients?: { name: string } | null;
}
```

---

## Vantagens da Refatoracao

| Aspecto | Antes (Modal) | Depois (Pagina) |
|---------|---------------|-----------------|
| Espaco | Limitado (~500px) | Tela completa |
| Informacoes | Parciais | Todas visiveis |
| Certificado | Nao visivel | Card dedicado |
| Capabilities | Nao visivel | Card dedicado |
| URL | Nao compartilhavel | Compartilhavel |
| UX | Scroll no modal | Layout organizado |
