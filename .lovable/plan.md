
## Contexto e ajuste de rumo (importante)
- Você informou corretamente: **Leaked Password Protection só está disponível no plano Pro (ou acima)** no Supabase. Então **não dá para ativar isso no seu projeto atual** via dashboard, e vamos seguir sem essa etapa.
- Já existe migration criando as tabelas necessárias para Domínio Externo:
  - `supabase/migrations/20260130014618_1a6df5b4-b48a-4094-a8bd-20a142d9e5a1.sql` cria:
    - `public.external_domains`
    - `public.external_domain_schedules`
    - índices + triggers `updated_at` + RLS policies
- Também existe uma migration “fix linter” para RLS:
  - `supabase/migrations/20260130014824_ea26f19d-3518-41c6-a351-334da9281a05.sql` ajusta policies de `rate_limits` e `task_step_results`.

## Problema atual
Na rota `/scope-external-domain/domains` (`src/pages/external-domain/ExternalDomainListPage.tsx`):
- O botão **Adicionar Domínio** só mostra toast.
- A lista de domínios é placeholder (sem busca no Supabase).
- Os cards de estatística são fixos “0”.

## Objetivo desta entrega
1) Botão **Adicionar Domínio** abrir um **modal de cadastro** no mesmo padrão do Firewall (Dialog + ScrollArea + Selects).
2) Cadastro **salvar no Supabase** (`external_domains` + `external_domain_schedules`) respeitando permissões (RLS).
3) Página listar domínios reais do Supabase (com client_name / schedule / agent opcionalmente), e atualizar contadores.

---

## Implementação (frontend)

### 1) Criar o modal `AddExternalDomainDialog` espelhado do Firewall
Criar arquivo:
- `src/components/external-domain/AddExternalDomainDialog.tsx`

Padrão a copiar/seguir:
- `src/components/firewall/AddFirewallDialog.tsx`

Campos (conforme combinado):
- **Cliente*** (Select) – lista de `clients`
- **Agent*** (Select) – carregar de `agents` filtrando por `client_id` e `revoked=false` (igual firewall)
- **Domínio Externo*** (Input)
- **Nome (opcional)** (Input)  
  - Se vazio, vamos preencher automaticamente no submit com o próprio domínio (para cumprir `name not null` da tabela).
- **Descrição** (Textarea)
- **Frequência de Análise** (Select) – `manual | daily | weekly | monthly`

Comportamento:
- Quando trocar Cliente: limpar Agent selecionado e recarregar lista de agents do cliente.
- Botão “Adicionar”:
  - disabled enquanto `saving` ou se campos obrigatórios não preenchidos.
  - mostrar feedback de erro (toast + erro inline no domínio).

### 2) Validação do “Domínio Externo”
Hoje existe `src/lib/urlValidation.ts` com validação de “base URL de dispositivo” (exige http/https e proíbe barras finais etc.).
Para Domínio Externo, o input pode ser:
- `example.com` (sem protocolo) OU
- `https://example.com` (com protocolo)
E deve bloquear path/query/hash.

Plano de validação:
- Adicionar uma função nova no mesmo arquivo para manter o padrão do projeto:
  - `getExternalDomainError(value: string): string | null`
- Regras sugeridas:
  - Trim obrigatório
  - Proibir espaços
  - Se começar com http(s), usar `new URL()` e exigir `pathname === '/'` e sem `search/hash`
  - Se não tiver protocolo, validar via regex de hostname (`sub.domínio.tld`) e proibir barras e `?` `#`
  - (Opcional) normalizar: salvar em `domain` exatamente como digitado, ou padronizar removendo `http(s)://` — definiremos um padrão para evitar duplicidade futura.

### 3) Atualizar `ExternalDomainListPage` para usar Supabase de verdade
Arquivo a alterar:
- `src/pages/external-domain/ExternalDomainListPage.tsx`

Mudanças:
1. Importar e usar:
   - `supabase` (`@/integrations/supabase/client`)
   - `AddExternalDomainDialog`
2. Criar estados adicionais (mesmo modelo do FirewallListPage):
   - `clients`, `agents` (se necessário manter global; mas o modal já busca agents por cliente — podemos manter apenas `clients` na página)
   - `domains` com dados reais
3. Implementar `fetchData()`:
   - `clients`: `supabase.from('clients').select('*').order('name')`
   - `external_domains`: `supabase.from('external_domains').select('*').order('created_at', { ascending: false })`
   - `external_domain_schedules`: buscar por `domain_id in (...)` (igual faz com `analysis_schedules`)
   - `agents`: opcional para mapear `agent_id -> name` na tabela (ou buscar no modal apenas; para a listagem fica melhor trazer nomes)
4. Combinar os dados em memória (mapas) como no firewall:
   - `clientMap`, `agentMap`, `scheduleMap`
5. Substituir o botão atual:
   - antes: `<Button onClick={() => toast.info(...)}/>`
   - depois: `<AddExternalDomainDialog clients={clients} onDomainAdded={handleAddDomain} />`
6. Implementar `handleAddDomain(formData)` semelhante ao firewall:
   - Insert em `external_domains`:
     - `client_id`, `agent_id`, `domain`, `name`, `description`, `created_by: user?.id`, `status: 'pending'`
   - Se schedule !== 'manual': insert em `external_domain_schedules` com `domain_id`, `frequency`, `is_active: true`, `created_by: user?.id`
   - `await fetchData()` e `toast.success(...)`
7. Atualizar cards “0” para valores reais:
   - total = `domains.length`
   - ativos = count `status === 'active'`
   - pendentes = count `status === 'pending'`
   - com problemas = por enquanto: `last_score !== null && last_score < 60` (ou 0 se preferir não assumir regra; definiremos um critério simples e explícito)

---

## Ajustes importantes / correções de consistência
### 4) Reverter alterações indevidas em `src/integrations/supabase/types.ts`
Você mostrou que em mensagens anteriores houve “edited src/integrations/supabase/types.ts”, mas o próprio projeto avisa que esse arquivo é gerado automaticamente e **não deve ser editado**.

Plano:
- Comparar com o conteúdo esperado (gerado) e **reverter quaisquer alterações locais** feitas nele.
- Se necessário, ajustar nossos tipos no frontend usando interfaces locais (como já é feito no FirewallListPage) em vez de tocar no `types.ts`.

---

## Segurança e permissões (RLS)
- As policies da migration `external_domains` já seguem o padrão correto:
  - Ver: `has_client_access(auth.uid(), client_id)`
  - Gerenciar: precisa `get_module_permission(auth.uid(), 'external_domain') in ('edit','full')`
- No frontend, o botão continua condicionado por:
  - `hasPermission('external_domain', 'edit')` (já existe no AuthContext)

---

## Checklist de teste end-to-end (aceitação)
1. Logar com um usuário que tenha acesso ao módulo `scope_external_domain`.
2. Ir em **Domínio Externo > Domínios Externos**.
3. Clicar **Adicionar Domínio**:
   - Modal abre
   - Cliente obrigatório
   - Agent habilita só após escolher cliente
   - Domínio valida corretamente (bloqueia `https://example.com/path` e aceita `example.com`)
4. Salvar:
   - Registro aparece na lista
   - Se frequência != manual, schedule é criado
5. Testar um usuário sem permissão edit:
   - Não vê botão
   - Não consegue inserir (RLS bloqueia)

---

## Entregáveis ao final
- Modal de cadastro funcionando (igual ao firewall em UX).
- Persistência no Supabase (`external_domains` e `external_domain_schedules`).
- Listagem real em `/scope-external-domain/domains`.
- `types.ts` intacto (sem edições manuais).

