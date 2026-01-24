

# Plano: Reorganizar Interface de Coletas por Tipo de Dispositivo

## Problema Atual

A página de Coletas (`/collections`) exibe todos os device types, blueprints e regras de compliance em seções separadas, mesmo que cada um esteja vinculado a um tipo específico de dispositivo. Isso causa:

1. **Confusão visual** - Regras do FortiGate e SonicWall aparecem misturadas
2. **Falta de contexto** - Não fica claro qual blueprint/regra pertence a qual dispositivo
3. **Navegação ineficiente** - Para gerenciar um dispositivo completo, precisa rolar por 3 seções diferentes

## Solução Proposta

Reorganizar a interface para que cada **Device Type** seja o elemento central, com seus blueprints e regras de compliance aninhados.

### Nova Estrutura Visual

```text
Coletas
├── Tab: Firewalls
│   ├── FortiGate (card expansível)
│   │   ├── Blueprints (2)
│   │   └── Regras de Compliance (23)
│   ├── SonicWall TZ (card expansível)
│   │   ├── Blueprints (1)
│   │   └── Regras de Compliance (6)
│   └── [+ Novo Tipo de Dispositivo]
│
├── Tab: Microsoft 365
└── Tab: Domínios Externos
```

### Layout do Card por Device Type

Cada device type terá um card com:

1. **Header do Card**
   - Ícone do dispositivo
   - Nome (Fabricante - Modelo)
   - Código
   - Badge de status (Ativo/Inativo)
   - Botões: Editar | Excluir

2. **Accordion interno com 2 seções**
   - **Blueprints** - Tabela compacta com os blueprints deste device
   - **Regras de Compliance** - Tabela compacta com as regras deste device

3. **Ações contextuais**
   - "+ Novo Blueprint" dentro da seção Blueprints
   - "+ Nova Regra" dentro da seção Regras

---

## Alterações Técnicas

### 1. Novo Componente: `DeviceTypeCard.tsx`

Componente que renderiza um card para cada device type, contendo:
- Header com informações do device
- Accordion com seções de Blueprints e Compliance Rules
- CRUD inline para cada seção

### 2. Modificar: `CollectionsPage.tsx`

- Remover as 3 seções separadas (DeviceTypes, Blueprints, ComplianceRules)
- Renderizar uma lista de `DeviceTypeCard` para cada device da categoria
- Adicionar botão "+ Novo Tipo de Dispositivo" no header

### 3. Refatorar Componentes Existentes

**Opção A (Reuso):** Manter os componentes existentes e usá-los dentro do `DeviceTypeCard` passando o `deviceTypeId` como filtro

**Opção B (Novo):** Criar versões compactas dos componentes para uso dentro do accordion

---

## Fluxo de Usuário Melhorado

**Antes:**
1. Abrir aba Firewalls
2. Procurar FortiGate na tabela de Device Types
3. Rolar para Blueprints e filtrar por FortiGate
4. Rolar para Regras e filtrar por FortiGate

**Depois:**
1. Abrir aba Firewalls
2. Clicar no card FortiGate para expandir
3. Ver todos os blueprints e regras deste device em um só lugar

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/admin/DeviceTypeCard.tsx` | Criar | Card expansível com blueprints e regras aninhados |
| `src/pages/admin/CollectionsPage.tsx` | Modificar | Usar DeviceTypeCard ao invés de 3 componentes separados |
| `src/components/admin/DeviceTypesManagement.tsx` | Manter | Reutilizar diálogos de CRUD |
| `src/components/admin/BlueprintsManagement.tsx` | Modificar | Adicionar prop `deviceTypeId` para filtrar |
| `src/components/admin/ComplianceRulesManagement.tsx` | Modificar | Adicionar prop `deviceTypeId` para filtrar |

---

## Wireframe Conceitual

```text
┌─────────────────────────────────────────────────────────┐
│ Coletas                                                 │
│ Gerencie tipos de dispositivos, blueprints e regras    │
├─────────────────────────────────────────────────────────┤
│ [Firewalls] [Microsoft 365] [Domínios Externos]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🛡️ Fortinet - FortiGate          fortigate  [Ativo]│ │
│ │                                   [Editar][Excluir] │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ▼ Blueprints (2)                    [+ Blueprint]   │ │
│ │   ┌─────────────────────────────────────────────┐   │ │
│ │   │ Nome              │ Versão │ Steps │ Status│   │ │
│ │   ├───────────────────┼────────┼───────┼───────┤   │ │
│ │   │ FortiGate Full    │ any    │ 12    │ Ativo │   │ │
│ │   │ FortiGate Quick   │ 7.x    │ 5     │ Ativo │   │ │
│ │   └─────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ ▼ Regras de Compliance (23)            [+ Regra]   │ │
│ │   ┌─────────────────────────────────────────────┐   │ │
│ │   │ Código      │ Nome          │ Sev. │ Status│   │ │
│ │   ├─────────────┼───────────────┼──────┼───────┤   │ │
│ │   │ FW_ADMIN_... │ Admin HTTPS  │ Alta │ Ativo │   │ │
│ │   │ FW_SSH_...   │ SSH Timeout  │ Média│ Ativo │   │ │
│ │   │ ...          │ ...          │ ...  │ ...   │   │ │
│ │   └─────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🛡️ SonicWall - TZ                sonicwall_tz [Ativo]│
│ │                                   [Editar][Excluir] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [+ Novo Tipo de Dispositivo]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Hierarquia clara** - Device Type como elemento central
2. **Contexto imediato** - Ver tudo relacionado a um device em um lugar
3. **Menos scroll** - Cards colapsáveis mantêm a página organizada
4. **Ações contextuais** - Criar blueprint/regra já com device selecionado
5. **Escalabilidade** - Funciona bem com 2 ou 20 device types

