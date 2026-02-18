
# Nova Tela: Wizard de Adição de Firewall (`/environment/new/firewall`)

## Contexto

Hoje, o botão "Firewall" na tela `/environment/new` redireciona para `/scope-firewall/firewalls/new`, que é a tela antiga do módulo Firewall. O objetivo é criar uma nova rota `/environment/new/firewall` com um wizard multi-etapas padronizado com a tela de Domínio Externo — e atualizar o `AddAssetPage.tsx` para apontar para essa nova rota.

## Estrutura do Wizard — 4 Etapas

```text
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1           STEP 2           STEP 3          STEP 4        │
│  Fabricante   →  Configuração  →  Instruções  →  Agendamento    │
│  (seleção)       (nome, URL,       (guia por        (frequência) │
│                  workspace,        fabricante)                   │
│                  agent, auth)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1 — Seleção de Fabricante
Cards grandes e clicáveis, um por fabricante disponível (buscados da tabela `device_types` com `category = 'firewall'`). Cada card exibe o nome do vendor e ícone. O usuário seleciona e avança.

### Step 2 — Informações do Firewall
Campos idênticos à lógica já existente em `FirewallCreatePage.tsx`:
- **Workspace** (visível apenas para super users, seguindo padrão do `AddExternalDomainPage`)
- **Nome do Firewall** — campo livre
- **URL do dispositivo** — com validação via `getDeviceUrlError()` e label dinâmico por vendor (FortiGate vs. SonicWall)
- **Autenticação** — condicional por vendor: API Key (FortiGate) ou Usuário + Senha (SonicWall, usando `SESSION_AUTH_DEVICE_CODES`)
- **Agent** — select filtrado pelo workspace selecionado
- **Localização** (lat/lng) — opcional com botão "Buscar" via `resolveGeoFromUrl()`
- **Descrição** — textarea opcional

### Step 3 — Instruções de Configuração (por Fabricante)
Esta é a etapa nova e diferencial do wizard. Exibe um guia contextual baseado no fabricante selecionado no Step 1:

**Para FortiGate:**
- Instrução de como criar um API Token de leitura no FortiGate (System > Admin Profiles > REST API Admin)
- Comandos CLI necessários para habilitar acesso à API
- Nota sobre portas e SSL

**Para SonicWall:**
- Instrução de como habilitar a API no SonicWall (Management > APIs)
- Criação de usuário local com perfil de leitura
- Nota sobre HTTPS Management Port

O usuário pode avançar sem confirmar (passo de leitura/orientação), mas entende o que precisa configurar no dispositivo.

### Step 4 — Agendamento
Idêntico ao card de Agendamento da tela de Domínio Externo:
- Frequência: Manual / Diária / Semanal / Mensal
- Horário (quando não manual)
- Dia da semana / Dia do mês (condicional)

## Indicador de Progresso

Barra de progresso horizontal no topo da área de conteúdo, com os 4 steps numerados e com labels, similar ao padrão usado no `TenantConnectionWizard.tsx` (já existe no projeto).

## Navegação

- Botão **Voltar** — retorna ao step anterior (ou para `/environment/new` no step 1)
- Botão **Próximo** — avança, com validação dos campos do step atual
- Botão **Adicionar** — no step 4, executa o `handleSubmit` com a mesma lógica existente em `FirewallCreatePage.tsx` (insert firewall + encrypt credentials + create schedule)
- Após sucesso: redireciona para `/environment`

## Arquivos a Criar / Modificar

### Criar
- **`src/pages/environment/AddFirewallPage.tsx`** — página principal do wizard (toda a lógica de estado e steps)

### Modificar
- **`src/pages/AddAssetPage.tsx`** — linha 25: trocar `route: '/scope-firewall/firewalls/new'` por `route: '/environment/new/firewall'`
- **`src/App.tsx`** — adicionar rota `<Route path="/environment/new/firewall" element={<AddFirewallPage />} />` com o import lazy correspondente

## Detalhes Técnicos

### Reutilização de lógica existente
Toda a lógica de submit, credenciais, geolocalização e schedule é portada diretamente de `FirewallCreatePage.tsx`, sem duplicação de chamadas ao backend. A tela antiga `/scope-firewall/firewalls/new` permanece intacta (pode ser usada pelo menu lateral do módulo).

### Dados do fabricante
A tabela `device_types` já retorna `id, name, vendor, code`. O Step 1 renderiza um card por registro. A seleção do `device_type_id` guia a lógica condicional dos steps seguintes.

### Compatibilidade com roles
Workspace selector visível apenas para `super_admin` / `super_suporte`, seguindo o padrão do `AddExternalDomainPage` e usando `useEffectiveAuth()`.

### Breadcrumbs
```text
Ambiente > Novo Item > Firewall
```

### Visual
Segue exatamente o padrão de `AddExternalDomainPage`: `AppLayout`, `PageBreadcrumb`, cards com `glass-card` quando aplicável, botões de ação no rodapé. O step indicator usa números circulares com linha de progresso.
