
## Configuração Inline de Categorias na aba "Fluxo de Análise"

### Objetivo
Permitir que o Super Admin configure, de forma inline, o **nome**, **ícone** e **cor** de cada categoria de compliance. Essas configurações serão salvas no banco de dados e refletidas dinamicamente nos relatórios de Análise de Compliance.

---

### Análise Atual

Atualmente, as cores e ícones de categoria estão **hardcoded** em vários arquivos:

| Arquivo | Uso |
|---------|-----|
| `BlueprintFlowVisualization.tsx` | Aba "Fluxo de Análise" (admin) |
| `ExternalDomainCategorySection.tsx` | Relatório web de Domínio Externo |
| `PDFCategorySection.tsx` | Relatório PDF |
| `CategorySection.tsx` | Relatório de Firewall |

As categorias são extraídas do campo `category` (text) da tabela `compliance_rules`.

---

### Proposta de Solução

#### 1. Nova Tabela: `rule_categories`

Criamos uma tabela para armazenar as configurações visuais das categorias por template (device_type):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Chave primária |
| `device_type_id` | uuid | FK para device_types |
| `name` | text | Nome da categoria (ex: "Segurança DNS") |
| `display_name` | text | Nome de exibição (opcional, para renomear) |
| `icon` | text | Nome do ícone Lucide (ex: "globe", "shield", "mail") |
| `color` | text | Cor Tailwind (ex: "cyan-600", "violet-500", "emerald-600") |
| `display_order` | integer | Ordem de exibição |
| `is_active` | boolean | Se está ativo |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Data de atualização |

#### 2. Edição Inline na Aba "Fluxo de Análise"

Na visualização de categorias existente, adicionamos um botão de edição que abre um popover/dialog com:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌐  Segurança DNS                          [3/5 regras]  [⚙️]     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Nome: [Segurança DNS____________]                           │    │
│  │  Ícone: [🌐 Globe ▾]                                        │    │
│  │  Cor:   [● Cyan-600 ▾]                                      │    │
│  │                                              [Salvar]        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Elementos de UI:**
- **Nome**: Input de texto simples
- **Ícone**: Select com os ícones Lucide mais comuns (preview visual)
- **Cor**: Select com paleta de cores (preview visual com círculo colorido)

#### 3. Consumo Dinâmico nos Relatórios

Os componentes de relatório (`ExternalDomainCategorySection`, `CategorySection`, `PDFCategorySection`) serão atualizados para:

1. Buscar as configurações de categoria do banco de dados via hook
2. Usar fallback para os valores hardcoded caso não exista configuração

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/` | Criar | Migration para tabela `rule_categories` |
| `src/components/admin/CategoryConfigPopover.tsx` | Criar | Componente de edição inline |
| `src/components/admin/BlueprintFlowVisualization.tsx` | Modificar | Adicionar botão de edição por categoria |
| `src/hooks/useCategoryConfig.ts` | Criar | Hook para buscar/atualizar configs |
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Modificar | Consumir configs do banco |
| `src/components/CategorySection.tsx` | Modificar | Consumir configs do banco |
| `src/components/pdf/sections/PDFCategorySection.tsx` | Modificar | Receber configs como props |

---

### Detalhes Técnicos

#### Migration SQL

```sql
CREATE TABLE rule_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type_id uuid NOT NULL REFERENCES device_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text,
  icon text NOT NULL DEFAULT 'shield',
  color text NOT NULL DEFAULT 'slate-500',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(device_type_id, name)
);

-- RLS Policies
ALTER TABLE rule_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage categories"
  ON rule_categories FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view active categories"
  ON rule_categories FOR SELECT
  USING (is_active = true);
```

#### Ícones Disponíveis (Subset Curado)

```typescript
const AVAILABLE_ICONS = [
  { name: 'shield', label: 'Escudo' },
  { name: 'globe', label: 'Globo' },
  { name: 'mail', label: 'Email' },
  { name: 'lock', label: 'Cadeado' },
  { name: 'key', label: 'Chave' },
  { name: 'server', label: 'Servidor' },
  { name: 'network', label: 'Rede' },
  { name: 'activity', label: 'Atividade' },
  { name: 'alert-triangle', label: 'Alerta' },
  { name: 'check-circle', label: 'Verificado' },
  { name: 'database', label: 'Banco de Dados' },
  { name: 'hard-drive', label: 'Armazenamento' },
  { name: 'cpu', label: 'Processador' },
  { name: 'settings', label: 'Configurações' },
  { name: 'user', label: 'Usuário' },
];
```

#### Cores Disponíveis (Paleta Curada)

```typescript
const AVAILABLE_COLORS = [
  { name: 'cyan-600', label: 'Ciano', hex: '#0891b2' },
  { name: 'violet-500', label: 'Violeta', hex: '#8b5cf6' },
  { name: 'emerald-600', label: 'Esmeralda', hex: '#059669' },
  { name: 'pink-500', label: 'Rosa', hex: '#ec4899' },
  { name: 'amber-500', label: 'Âmbar', hex: '#f59e0b' },
  { name: 'blue-500', label: 'Azul', hex: '#3b82f6' },
  { name: 'red-500', label: 'Vermelho', hex: '#ef4444' },
  { name: 'green-500', label: 'Verde', hex: '#22c55e' },
  { name: 'orange-500', label: 'Laranja', hex: '#f97316' },
  { name: 'purple-500', label: 'Roxo', hex: '#a855f7' },
  { name: 'slate-500', label: 'Cinza', hex: '#64748b' },
];
```

#### Componente CategoryConfigPopover

```tsx
interface CategoryConfigPopoverProps {
  category: string;
  deviceTypeId: string;
  currentConfig?: {
    display_name?: string;
    icon: string;
    color: string;
  };
  onSave: () => void;
}

// Renderiza um Popover com:
// - Input para nome de exibição
// - Select visual para ícone
// - Select visual para cor (com preview colorido)
// - Botão salvar
```

---

### Fluxo de Funcionamento

1. **Primeira vez**: Ao acessar a aba "Fluxo de Análise", o sistema verifica se existem configurações para as categorias do template
2. **Sem configuração**: Usa os valores hardcoded como fallback (compatibilidade retroativa)
3. **Com configuração**: Aplica as cores/ícones do banco de dados
4. **Edição inline**: Clique no ícone de engrenagem abre o popover de edição
5. **Salva**: Insere/atualiza a configuração na tabela `rule_categories`
6. **Propagação**: Todas as páginas de relatório que usam esse template refletirão as mudanças

---

### Resultado Esperado

1. **Edição visual simples**: Configurar categorias sem sair da aba "Fluxo de Análise"
2. **Feedback imediato**: Ver preview do ícone e cor selecionados
3. **Persistência**: Configurações salvas no banco de dados
4. **Reflexo nos relatórios**: Web e PDF exibem as cores/ícones configurados
5. **Compatibilidade**: Fallback para hardcoded quando não há configuração

