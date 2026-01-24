
# Plano: Administração de Coletas e Regras de Compliance

## Visão Geral

Criar uma nova seção de administração chamada **"Coletas"** que centraliza a gestão de:
1. **Regras de Compliance** - As verificações de segurança avaliadas
2. **Blueprints de Coleta** - Os passos de coleta executados pelos agents
3. **Tipos de Dispositivos** - Os vendors/modelos suportados

Esta estrutura suporta a expansão para novos módulos (Microsoft 365, Domínios Externos, outros firewalls como Palo Alto, Sophos, etc.)

## Análise de Organização

### Opções Consideradas

| Formato | Prós | Contras |
|---------|------|---------|
| **Abas por Tipo de Dado** (Regras / Blueprints / Dispositivos) | Lógico para admins técnicos | Difícil navegar entre vendors |
| **Abas por Módulo** (Firewall / M365 / Domínios) | Intuitivo, agrupa por contexto | Duplicação de estrutura |
| **Híbrido: Árvore Lateral + Conteúdo** | Navegação flexível | Mais complexo de implementar |

### Recomendação: Abas por Módulo/Categoria

Considerando que cada módulo (Firewall, M365, Domínios) terá estruturas de coleta muito diferentes, a organização por **módulo/categoria** é a mais intuitiva:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Administração > Coletas                                            │
├─────────────────────────────────────────────────────────────────────┤
│  [🛡 Firewalls] [☁ Microsoft 365] [🌐 Domínios Externos]            │
├─────────────────────────────────────────────────────────────────────┤
│  Dentro de cada aba:                                                 │
│                                                                      │
│  📋 Sub-abas ou Accordion:                                          │
│     ├── Tipos de Dispositivos (FortiGate, Palo Alto, etc.)         │
│     ├── Blueprints de Coleta (passos do agent)                      │
│     └── Regras de Compliance (verificações)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Estrutura do Banco de Dados Atual

Já temos as tabelas necessárias:

- **device_types**: Tipos de dispositivo (FortiGate, etc.) com categoria (firewall, cloud, etc.)
- **device_blueprints**: Passos de coleta (collection_steps JSON) vinculados a device_type
- **compliance_rules**: Regras de avaliação com evaluation_logic JSON, vinculadas a device_type

### Dados Atuais (Firewall)
- 1 device_type: FortiGate
- 1 blueprint: FortiGate Standard Compliance (9 steps)
- 8 compliance_rules: Regras básicas de firewall

## Arquitetura da Nova Página

### Nova Rota e Componentes

```text
src/pages/admin/
├── SettingsPage.tsx (existente)
└── CollectionsPage.tsx (NOVO)

src/components/admin/
├── ModulesManagement.tsx (existente)
├── DeviceTypesManagement.tsx (NOVO)
├── BlueprintsManagement.tsx (NOVO)
└── ComplianceRulesManagement.tsx (NOVO)
```

### Detalhes da Implementação

#### 1. Nova Página: CollectionsPage.tsx

- Rota: `/collections`
- Acesso: super_admin apenas
- Estrutura: Tabs por categoria de dispositivo (Firewalls, Microsoft 365, Domínios)

#### 2. Componente: DeviceTypesManagement.tsx

Gerencia device_types filtrado por categoria:

| Campo | Descrição |
|-------|-----------|
| vendor | Fabricante (Fortinet, Palo Alto, Microsoft) |
| name | Nome do dispositivo (FortiGate, Azure AD) |
| code | Código único (fortigate, entra_id) |
| icon | Ícone Lucide |
| is_active | Ativo/Inativo |

#### 3. Componente: BlueprintsManagement.tsx

Gerencia device_blueprints:

| Campo | Descrição |
|-------|-----------|
| name | Nome do blueprint |
| device_type_id | Tipo de dispositivo |
| version | Versão compatível (any, 7.x, etc.) |
| collection_steps | JSON com passos de coleta |

Editor visual para passos:
- Cada step tem: id, executor (http_request, ssh, snmp), config
- Possibilidade de reordenar, duplicar, excluir steps

#### 4. Componente: ComplianceRulesManagement.tsx

Gerencia compliance_rules:

| Campo | Descrição |
|-------|-----------|
| code | Código único (admin_timeout) |
| name | Nome legível |
| category | Categoria no relatório (Segurança, Rede) |
| severity | Severidade (critical, high, medium, low) |
| description | Descrição detalhada |
| recommendation | Recomendação de correção |
| pass_description | Mensagem quando passa |
| fail_description | Mensagem quando falha |
| weight | Peso no score |
| evaluation_logic | JSON com lógica de avaliação |

Editor visual para evaluation_logic:
- source_key: De qual step do blueprint vem o dado
- field_path: Caminho no JSON para o valor
- conditions: Array de condições (operator, value, result)
- default_result: Resultado padrão

## Wireframe da Interface

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡 Coletas                                                    [+ Novo Tipo] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Firewalls ▾] [Microsoft 365] [Domínios Externos]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 📦 TIPOS DE DISPOSITIVOS                                                    │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ FortiGate              Fortinet           🟢 Ativo    [✏️] [🗑️]       │   │
│ │ Palo Alto              Palo Alto Networks 🔴 Inativo  [✏️] [🗑️]       │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ 📋 BLUEPRINTS DE COLETA                                    [+ Novo Blueprint]│
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ FortiGate Standard Compliance    FortiGate   any   9 steps   [✏️]     │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ✓ REGRAS DE COMPLIANCE (8)                                    [+ Nova Regra]│
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ Filtro: [Todos ▾] [Pesquisar...]                                       │   │
│ ├───────────────────────────────────────────────────────────────────────┤   │
│ │ admin_timeout     Timeout de Sessão Admin     🟠 medium   [✏️] [🗑️]   │   │
│ │ https_admin       Acesso HTTPS Administrativo 🔴 high     [✏️] [🗑️]   │   │
│ │ password_policy   Política de Senha Admin     🔴 high     [✏️] [🗑️]   │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/admin/CollectionsPage.tsx` | Criar | Página principal de coletas |
| `src/components/admin/DeviceTypesManagement.tsx` | Criar | CRUD de tipos de dispositivo |
| `src/components/admin/BlueprintsManagement.tsx` | Criar | CRUD de blueprints |
| `src/components/admin/ComplianceRulesManagement.tsx` | Criar | CRUD de regras |
| `src/components/layout/AppLayout.tsx` | Modificar | Adicionar link no menu Administração |
| `src/App.tsx` | Modificar | Adicionar rota /collections |

## Fases de Implementação

### Fase 1: Estrutura Base
1. Criar `CollectionsPage.tsx` com layout de tabs
2. Criar `DeviceTypesManagement.tsx` (CRUD simples)
3. Adicionar rota e menu

### Fase 2: Blueprints
1. Criar `BlueprintsManagement.tsx`
2. Editor JSON para collection_steps
3. Visualização dos passos de coleta

### Fase 3: Regras de Compliance
1. Criar `ComplianceRulesManagement.tsx`
2. Editor de evaluation_logic
3. Pré-visualização de teste da regra

### Fase 4: Expansão
1. Adicionar suporte para Microsoft 365 (device_category: 'cloud')
2. Adicionar suporte para Domínios Externos (nova categoria)

## Resultado Esperado

1. Super Admins podem gerenciar todas as coletas e regras via interface
2. Adição de novos vendors/dispositivos sem alteração de código
3. Regras de compliance configuráveis com descrições completas
4. Estrutura preparada para Microsoft 365 e Domínios Externos
5. Blueprints editáveis para ajustar passos de coleta
