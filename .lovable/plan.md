
# Plano: Expor Campos de Metadados nas Regras de Compliance

## Objetivo

Tornar os campos `technical_risk`, `business_impact` e `api_endpoint` visíveis e editáveis na interface de administração de templates, além de exibi-los nos relatórios de compliance.

---

## Situação Atual

| Componente | Status |
|------------|--------|
| `ComplianceRulesTable.tsx` | Campos existentes no formulário (linhas 531-563) |
| `TemplateRulesManagement.tsx` | Campos **não existem** no formulário |
| `ComplianceCard.tsx` | **Não exibe** Risco Técnico e Impacto no Negócio |
| Edge Function `agent-task-result` | **Não inclui** os campos no output |
| Banco de dados | Colunas criadas na migração anterior |

---

## Alterações Necessárias

### 1. Atualizar `TemplateRulesManagement.tsx`

Adicionar os campos novos ao formulário de criação/edição de regras:

**Form State (linha ~103-116):**
```typescript
const [formData, setFormData] = useState({
  // ... campos existentes ...
  technical_risk: '',
  business_impact: '',
  api_endpoint: '',
});
```

**Reset Form (linha ~142-157):**
```typescript
const resetForm = () => {
  setFormData({
    // ... campos existentes ...
    technical_risk: '',
    business_impact: '',
    api_endpoint: '',
  });
};
```

**Open Dialog Edit (linha ~159-179):**
```typescript
setFormData({
  // ... campos existentes ...
  technical_risk: rule.technical_risk || '',
  business_impact: rule.business_impact || '',
  api_endpoint: rule.api_endpoint || '',
});
```

**Handle Save (linha ~199-254):**
```typescript
const ruleData = {
  // ... campos existentes ...
  technical_risk: formData.technical_risk || null,
  business_impact: formData.business_impact || null,
  api_endpoint: formData.api_endpoint || null,
};
```

**Formulário UI (após linha ~535):**
```tsx
{/* Novos campos: Risco Técnico e Impacto no Negócio */}
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label htmlFor="technical_risk">Risco Técnico</Label>
    <Textarea
      id="technical_risk"
      value={formData.technical_risk}
      onChange={(e) => setFormData({ ...formData, technical_risk: e.target.value })}
      placeholder="Descreva o risco técnico caso esta regra falhe..."
      rows={2}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="business_impact">Impacto no Negócio</Label>
    <Textarea
      id="business_impact"
      value={formData.business_impact}
      onChange={(e) => setFormData({ ...formData, business_impact: e.target.value })}
      placeholder="Descreva o impacto no negócio se não corrigido..."
      rows={2}
    />
  </div>
</div>

<div className="space-y-2">
  <Label htmlFor="api_endpoint">Endpoint da API</Label>
  <Input
    id="api_endpoint"
    value={formData.api_endpoint}
    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
    placeholder="Ex: /api/v2/cmdb/system/global"
  />
</div>
```

**View Dialog (após linha ~591):**
Adicionar exibição dos novos campos no dialog de visualização.

---

### 2. Atualizar Edge Function `agent-task-result`

**Interface ComplianceRule (linha ~38-51):**
```typescript
interface ComplianceRule {
  // ... campos existentes ...
  technical_risk: string | null;
  business_impact: string | null;
  api_endpoint: string | null;
}
```

**Interface ComplianceCheck (linha ~74-88):**
```typescript
interface ComplianceCheck {
  // ... campos existentes ...
  technicalRisk?: string;
  businessImpact?: string;
}
```

**Query de busca das regras:**
Incluir os novos campos na query (já são retornados pois usamos `select('*')`).

**Criação do check (linha ~3329-3342):**
```typescript
checks.push({
  // ... campos existentes ...
  technicalRisk: rule.technical_risk || undefined,
  businessImpact: rule.business_impact || undefined,
});
```

---

### 3. Atualizar `ComplianceCard.tsx`

Adicionar exibição de Risco Técnico e Impacto no Negócio no conteúdo expandido:

```tsx
{/* RISCO TÉCNICO - visível para todos quando falha */}
{check.technicalRisk && check.status !== 'pass' && (
  <div className="space-y-2">
    <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
      <AlertTriangle className="w-3 h-3 text-warning" />
      RISCO TÉCNICO
    </h5>
    <div className="bg-warning/10 rounded-md p-3 border border-warning/30">
      <p className="text-sm text-foreground">{check.technicalRisk}</p>
    </div>
  </div>
)}

{/* IMPACTO NO NEGÓCIO - visível para todos quando falha */}
{check.businessImpact && check.status !== 'pass' && (
  <div className="space-y-2">
    <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
      <Building2 className="w-3 h-3 text-destructive" />
      IMPACTO NO NEGÓCIO
    </h5>
    <div className="bg-destructive/10 rounded-md p-3 border border-destructive/30">
      <p className="text-sm text-foreground">{check.businessImpact}</p>
    </div>
  </div>
)}
```

---

## Estrutura da Seção Expandida (Padronizada)

| Seção | Visibilidade | Condição de Exibição |
|-------|--------------|----------------------|
| Endpoint consultado | Super Admin / Super Suporte | Sempre (se preenchido) |
| ANÁLISE EFETUADA | Todos | Sempre (se houver details/description) |
| RISCO TÉCNICO | Todos | Apenas se status != pass |
| IMPACTO NO NEGÓCIO | Todos | Apenas se status != pass |
| EVIDÊNCIAS COLETADAS | Todos | Sempre (se houver evidence) |
| Dados brutos (JSON) | Super Admin / Super Suporte | Sempre (se houver rawData) |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/TemplateRulesManagement.tsx` | Adicionar campos technical_risk, business_impact, api_endpoint ao formulário |
| `src/components/ComplianceCard.tsx` | Adicionar seções Risco Técnico e Impacto no Negócio |
| `supabase/functions/agent-task-result/index.ts` | Incluir campos nos tipos e no output |

---

## Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMINISTRAÇÃO (Templates)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Editar Regra                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Risco Técnico: [textarea]                                    │   │
│  │ Impacto no Negócio: [textarea]                               │   │
│  │ Endpoint da API: [input]                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│              compliance_rules (DB)                                  │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTION                                   │
├─────────────────────────────────────────────────────────────────────┤
│  agent-task-result                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Busca regras do DB (inclui technical_risk, etc.)         │   │
│  │ 2. Avalia dados coletados                                    │   │
│  │ 3. Monta ComplianceCheck com campos novos                    │   │
│  │ 4. Salva report_data no histórico                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       RELATÓRIO                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ComplianceCard                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [Header com status e severidade]                             │   │
│  │                                                               │   │
│  │ ▼ Expandido (quando falha):                                  │   │
│  │   ├─ Endpoint consultado (admin only)                        │   │
│  │   ├─ ANÁLISE EFETUADA                                        │   │
│  │   ├─ RISCO TÉCNICO                                           │   │
│  │   ├─ IMPACTO NO NEGÓCIO                                      │   │
│  │   ├─ EVIDÊNCIAS COLETADAS                                    │   │
│  │   └─ Dados brutos JSON (admin only)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

- Administrador pode customizar textos sem depender de código
- Dados estáticos (riscos, impactos) são gerenciados via UI
- Dados dinâmicos (evidências, status) são coletados pelo agente
- Separação clara entre configuração e execução
- Relatórios mais informativos para o usuário final
