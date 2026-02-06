
# Plano: Migrar Guia de Correções para Banco de Dados

## Objetivo

Migrar os textos do "Guia de Correções" do arquivo hardcoded (`explanatoryContent.ts`) para o banco de dados, permitindo edição via interface administrativa sem necessidade de alterações no código.

---

## Análise da Situação Atual

### Estrutura do `EXPLANATORY_CONTENT` (arquivo `.ts`)

| Campo | Tipo | Exemplo |
|-------|------|---------|
| `friendlyTitle` | string | "Proteção contra emails falsos (DMARC)" |
| `whatIs` | string | "Sistema que protege seu domínio..." |
| `whyMatters` | string | "Sem DMARC, qualquer pessoa pode..." |
| `impacts` | string[] | ["Clientes podem receber...", "Perda de confiança..."] |
| `howToFix` | string[] | ["Acesse o painel DNS...", "Adicione registro TXT..."] |
| `difficulty` | 'low' \| 'medium' \| 'high' | "low" |
| `timeEstimate` | string | "15 min" |
| `providerExamples` | string[] (opcional) | ["Cloudflare", "Registro.br"] |

### Cobertura Atual

- **23 regras** no banco (template Domínio Externo)
- **~17 regras** com conteúdo no `EXPLANATORY_CONTENT`
- **~6 regras** faltando: DKIM-003, DMARC-004/005/006, MX-003/004/005

---

## Alterações Necessárias

### 1. Criar Nova Tabela no Banco de Dados

```sql
CREATE TABLE rule_correction_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência à regra
  rule_id UUID NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  
  -- Textos do guia
  friendly_title TEXT,
  what_is TEXT,
  why_matters TEXT,
  impacts JSONB DEFAULT '[]'::jsonb,          -- Array de strings
  how_to_fix JSONB DEFAULT '[]'::jsonb,       -- Array de strings
  provider_examples JSONB DEFAULT '[]'::jsonb, -- Array de strings (opcional)
  
  -- Metadados
  difficulty TEXT CHECK (difficulty IN ('low', 'medium', 'high')) DEFAULT 'medium',
  time_estimate TEXT DEFAULT '30 min',
  
  -- Controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(rule_id)
);

-- RLS Policies
ALTER TABLE rule_correction_guides ENABLE ROW LEVEL SECURITY;

-- Super admins podem gerenciar
CREATE POLICY "Super admins can manage guides"
  ON rule_correction_guides FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Usuários podem visualizar
CREATE POLICY "Users can view guides"
  ON rule_correction_guides FOR SELECT
  USING (true);
```

---

### 2. Migrar Dados Existentes

Inserir os dados do `EXPLANATORY_CONTENT` na nova tabela:

```sql
-- Exemplo para DMARC-001
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT 
  cr.id,
  'Proteção contra emails falsos (DMARC)',
  'Sistema que protege seu domínio contra envio de emails falsos por terceiros.',
  'Sem DMARC, qualquer pessoa pode enviar emails fingindo ser sua empresa...',
  '["Clientes podem receber emails fraudulentos", "Perda de confiança", ...]'::jsonb,
  '["Acesse o painel DNS...", "Adicione registro TXT...", ...]'::jsonb,
  'low',
  '15 min',
  '["Cloudflare", "Registro.br", "GoDaddy", "Microsoft 365"]'::jsonb
FROM compliance_rules cr
WHERE cr.code = 'DMARC-001'
  AND cr.device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

---

### 3. Adicionar Nova Aba no TemplateDetailPage

**Arquivo:** `src/pages/admin/TemplateDetailPage.tsx`

Adicionar nova aba "Guia de Correções":

```tsx
<TabsTrigger value="guides" className="gap-2">
  <BookOpen className="w-4 h-4" />
  Guia de Correções
  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
    {guidesCount}
  </Badge>
</TabsTrigger>

<TabsContent value="guides" className="mt-6">
  <CorrectionGuidesManagement deviceTypeId={id!} />
</TabsContent>
```

---

### 4. Criar Componente de Gerenciamento

**Novo arquivo:** `src/components/admin/CorrectionGuidesManagement.tsx`

Interface para gerenciar os textos do guia:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Guia de Correções                                            [Nova Entrada]│
├─────────────────────────────────────────────────────────────────────────────┤
│  Regra         │ Título Amigável            │ Dificuldade │ Tempo │ Ações   │
├────────────────┼────────────────────────────┼─────────────┼───────┼─────────┤
│  DMARC-001     │ Proteção contra emails...  │ Baixa       │ 15min │ [✏️][🗑️]│
│  DMARC-002     │ Política DMARC permissiva  │ Baixa       │ 10min │ [✏️][🗑️]│
│  SPF-001       │ Lista de servidores...     │ Baixa       │ 15min │ [✏️][🗑️]│
│  DNS-001       │ (sem guia configurado)     │ -           │ -     │ [➕]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Diálogo de Edição:**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Editar Guia de Correção - DMARC-001                                    [X] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Título Amigável *                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Proteção contra emails falsos (DMARC)                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  O que é *                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Sistema que protege seu domínio contra envio de emails falsos...   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Por que importa *                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Sem DMARC, qualquer pessoa pode enviar emails fingindo ser...      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Impactos Possíveis (um por linha)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Clientes podem receber emails fraudulentos em seu nome             │    │
│  │ Perda de confiança e danos à reputação                             │    │
│  │ Emails legítimos podem ir para spam                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Como Corrigir (passos numerados, um por linha)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Acesse o painel DNS do seu domínio                                 │    │
│  │ Adicione um novo registro do tipo TXT                              │    │
│  │ Nome: _dmarc.seudominio.com.br                                     │    │
│  │ Valor: v=DMARC1; p=none; rua=mailto:admin@...                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Dificuldade     │  │ Tempo Estimado  │  │ Exemplos de Provedores      │  │
│  │ [▼ Baixa    ]   │  │ [ 15 min     ]  │  │ Cloudflare, Registro.br,... │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                                             │
│                                             [Cancelar]  [Salvar]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Atualizar Componente do PDF

**Arquivo:** `src/components/pdf/ExternalDomainPDF.tsx`

Alterar para buscar dados do banco em vez do arquivo hardcoded:

```typescript
// Antes (hardcoded)
import { getExplanatoryContent } from './data/explanatoryContent';

// Depois (do banco)
const { data: correctionGuides } = useQuery({
  queryKey: ['correction-guides', deviceTypeId],
  queryFn: async () => {
    const { data } = await supabase
      .from('rule_correction_guides')
      .select('*, compliance_rules!inner(code)')
      .eq('compliance_rules.device_type_id', deviceTypeId);
    return data;
  },
});

// Helper para buscar guia por código da regra
const getGuideContent = (ruleCode: string) => {
  const guide = correctionGuides?.find(g => g.compliance_rules.code === ruleCode);
  if (guide) {
    return {
      friendlyTitle: guide.friendly_title || rule.name,
      whatIs: guide.what_is || rule.description,
      whyMatters: guide.why_matters || '',
      impacts: guide.impacts || [],
      howToFix: guide.how_to_fix || [rule.recommendation],
      difficulty: guide.difficulty || 'medium',
      timeEstimate: guide.time_estimate || '30 min',
    };
  }
  // Fallback para regras sem guia
  return getExplanatoryContent(ruleCode, rule.name, rule.description, rule.recommendation);
};
```

---

### 6. Manter Fallback para Compatibilidade

O arquivo `explanatoryContent.ts` será mantido como **fallback** para regras que ainda não têm guia no banco. Isso garante compatibilidade durante a migração.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_create_rule_correction_guides.sql` | **Criar** tabela + migrar dados |
| `src/components/admin/CorrectionGuidesManagement.tsx` | **Criar** componente de gerenciamento |
| `src/pages/admin/TemplateDetailPage.tsx` | **Modificar** - adicionar nova aba |
| `src/components/pdf/ExternalDomainPDF.tsx` | **Modificar** - buscar do banco |
| `src/integrations/supabase/types.ts` | Auto-atualizado pelo Supabase |

---

## Benefícios

- Administradores podem editar textos do Guia de Correções sem depender de desenvolvedores
- Novos templates (ex: FortiGate, SonicWall) podem ter seus próprios guias
- Manutenção centralizada no banco de dados
- Interface amigável para edição de textos complexos (impactos, passos de correção)
- Fallback automático para regras sem guia configurado
