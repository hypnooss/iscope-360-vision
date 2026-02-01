

## Reestruturação da Tela de Coletas (Administração)

### Objetivo

Reorganizar a interface da tela "Administração > Coletas" para eliminar aninhamentos excessivos e criar uma estrutura clara com 4 painéis distintos:

1. **Fluxo de Análise** - Visualização unificada do fluxo completo
2. **Blueprints** - CRUD de blueprints
3. **Regras de Compliance** - CRUD de regras
4. **Parses** - CRUD de traduções/humanizações (novo!)

---

### Problema Atual

A estrutura atual tem muitos níveis de aninhamento:

```text
Aba (Domínios Externos)
  └── DeviceType Card (iScope - Domínio Externo)
        └── Accordion (Blueprints) ← Nível 1
              └── Tabela
                    └── Expandir Blueprint ← Nível 2
                          └── Fluxo de Coleta → Regras ← Nível 3
        └── Accordion (Regras) ← Separado
```

---

### Nova Estrutura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Administração > Coletas                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Firewalls] [Microsoft 365] [Domínios Externos]                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  iScope - Domínio Externo  external_domain  [Ativo]        [Editar][X] │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ Tabs horizontais dentro do Device Type ─────────────────────────────────┐
│  │  [Fluxo de Análise] [Blueprints] [Regras de Compliance] [Parses]        │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ╔══════════════════════════════════════════════════════════════════════════╗
│  ║  TAB 1: FLUXO DE ANÁLISE                                                 ║
│  ║  ────────────────────────────────────────────────────────────────────────║
│  ║                                                                          ║
│  ║  ┌─ Step: ns_records (DNS Query) ────────────────────────────────────┐  ║
│  ║  │  Consulta NS                                                       │  ║
│  ║  │  ┌─ Regras vinculadas ─────────────────────────────────────────┐  │  ║
│  ║  │  │  DNS-003 (Médio) • DNS-004 (Médio)                         │  │  ║
│  ║  │  └─────────────────────────────────────────────────────────────┘  │  ║
│  ║  │  ┌─ Parses vinculados ─────────────────────────────────────────┐  │  ║
│  ║  │  │  ns_records.host → "Nameserver"                            │  │  ║
│  ║  │  │  ns_records.data.records → Lista de NS                     │  │  ║
│  ║  │  └─────────────────────────────────────────────────────────────┘  │  ║
│  ║  └────────────────────────────────────────────────────────────────────┘  ║
│  ║                                                                          ║
│  ║  ┌─ Step: mx_records (DNS Query) ────────────────────────────────────┐  ║
│  ║  │  ...                                                               │  ║
│  ║  └────────────────────────────────────────────────────────────────────┘  ║
│  ║                                                                          ║
│  ╚══════════════════════════════════════════════════════════════════════════╝
│                                                                              │
│  ╔══════════════════════════════════════════════════════════════════════════╗
│  ║  TAB 2: BLUEPRINTS                                                       ║
│  ║  ────────────────────────────────────────────────────────────────────────║
│  ║  [+ Novo Blueprint]                                                       ║
│  ║  ┌────────────────────────────────────────────────────────────────────┐  ║
│  ║  │  Nome           │ Versão │ Steps │ Status │ Ações                 │  ║
│  ║  │  External DNS   │ any    │ 7     │ Ativo  │ [👁] [📋] [✏] [🗑]     │  ║
│  ║  └────────────────────────────────────────────────────────────────────┘  ║
│  ╚══════════════════════════════════════════════════════════════════════════╝
│                                                                              │
│  ╔══════════════════════════════════════════════════════════════════════════╗
│  ║  TAB 3: REGRAS DE COMPLIANCE                                             ║
│  ║  ────────────────────────────────────────────────────────────────────────║
│  ║  [+ Nova Regra]                                                           ║
│  ║  ┌────────────────────────────────────────────────────────────────────┐  ║
│  ║  │  Código  │ Nome                    │ Categoria │ Sev.  │ Ações    │  ║
│  ║  │  DNS-001 │ DNSSEC Habilitado       │ DNS       │ Alto  │ [👁][✏]  │  ║
│  ║  │  SPF-001 │ SPF Configurado         │ SPF       │ Alto  │ [👁][✏]  │  ║
│  ║  └────────────────────────────────────────────────────────────────────┘  ║
│  ╚══════════════════════════════════════════════════════════════════════════╝
│                                                                              │
│  ╔══════════════════════════════════════════════════════════════════════════╗
│  ║  TAB 4: PARSES (NOVO!)                                                   ║
│  ║  ────────────────────────────────────────────────────────────────────────║
│  ║  Traduções e formatações para humanizar dados técnicos                    ║
│  ║  [+ Novo Parse]                                                           ║
│  ║  ┌────────────────────────────────────────────────────────────────────┐  ║
│  ║  │  Campo Origem      │ Label Exibido    │ Tipo  │ Ações              │  ║
│  ║  │  data.has_dnskey   │ Status DNSSEC    │ bool  │ [✏] [🗑]            │  ║
│  ║  │  data.mname        │ Servidor Primário│ text  │ [✏] [🗑]            │  ║
│  ║  │  data.refresh      │ Tempo de Refresh │ time  │ [✏] [🗑]            │  ║
│  ║  └────────────────────────────────────────────────────────────────────┘  ║
│  ╚══════════════════════════════════════════════════════════════════════════╝
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Nova Tabela: `evidence_parses`

Para mover os parses (traduções) do código para o banco de dados:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `device_type_id` | uuid | FK para device_types |
| `source_field` | text | Campo de origem (ex: `data.has_dnskey`) |
| `display_label` | text | Label humanizado (ex: "Status DNSSEC") |
| `parse_type` | enum | Tipo de parse: `text`, `boolean`, `time`, `list`, `json` |
| `value_transformations` | jsonb | Mapeamento de valores (ex: `{true: "Ativado", false: "Desativado"}`) |
| `format_options` | jsonb | Opções de formatação (ex: time_unit: "seconds") |
| `is_hidden` | boolean | Se deve ocultar este campo na UI |
| `display_order` | integer | Ordem de exibição |
| `is_active` | boolean | Se está ativo |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Data de atualização |

**Exemplo de dados:**
```json
{
  "source_field": "data.has_dnskey",
  "display_label": "Status DNSSEC",
  "parse_type": "boolean",
  "value_transformations": {
    "true": "DNSSEC Ativado",
    "false": "DNSSEC Desativado"
  }
}
```

---

### Componentes a Criar/Modificar

#### 1. Nova Migração SQL
**Criar:** `supabase/migrations/xxx_create_evidence_parses.sql`
- Criar tabela `evidence_parses`
- Migrar dados hardcoded do `EvidenceDisplay.tsx` para a tabela
- Criar RLS policies

#### 2. Refatorar `DeviceTypeCard.tsx`
**Modificar:** `src/components/admin/DeviceTypeCard.tsx`
- Substituir Accordion por Tabs horizontais
- Reorganizar para 4 abas:
  - Tab 1: Fluxo de Análise (visualização)
  - Tab 2: Blueprints (CRUD)
  - Tab 3: Regras de Compliance (CRUD)
  - Tab 4: Parses (CRUD - novo!)
- Remover aninhamentos excessivos

#### 3. Atualizar `BlueprintFlowVisualization.tsx`
**Modificar:** `src/components/admin/BlueprintFlowVisualization.tsx`
- Adicionar visualização de parses vinculados a cada step
- Mostrar relação step → regras → parses

#### 4. Criar componente de CRUD para Parses
**Criar:** `src/components/admin/ParsesManagement.tsx`
- Tabela de parses
- Diálogos de criar/editar/excluir
- Formulário para configurar traduções

#### 5. Atualizar `EvidenceDisplay.tsx`
**Modificar:** `src/components/compliance/EvidenceDisplay.tsx`
- Buscar parses do banco de dados em vez de usar mapeamento hardcoded
- Manter fallback para parses não encontrados
- Criar hook `useEvidenceParses()` para cache

---

### Benefícios

1. **Menos aninhamento** - Interface mais limpa e navegável
2. **Separação de responsabilidades** - Cada aba tem um propósito claro
3. **Parses no banco** - Administradores podem editar traduções sem código
4. **Visão unificada** - Tab "Fluxo de Análise" mostra todo o pipeline
5. **Escalável** - Mesma estrutura para Firewall, M365, etc.

---

### Ordem de Implementação

1. Criar migração SQL para tabela `evidence_parses`
2. Popular tabela com dados do `EvidenceDisplay.tsx`
3. Criar componente `ParsesManagement.tsx`
4. Refatorar `DeviceTypeCard.tsx` para usar Tabs
5. Atualizar `BlueprintFlowVisualization.tsx` para incluir parses
6. Atualizar `EvidenceDisplay.tsx` para buscar do banco
7. Testar o fluxo completo

