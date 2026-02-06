
# Plano: Adicionar Estado "Não Encontrado" aos Cards de Preview

## Objetivo

Adicionar um terceiro estado (**Não Encontrado** / `not_found`) aos cards de preview de regras na aba Fluxo de Análise, para representar situações onde os dados simplesmente não existem (ex: nenhum servidor RADIUS configurado).

---

## Contexto

| Status | Significado | Exemplo |
|--------|-------------|---------|
| `pass` | Configuração correta e segura | LDAP configurado com LDAPS |
| `fail` | Configuração insegura ou incorreta | LDAP configurado sem criptografia |
| `not_found` | Recurso não configurado/utilizado | Nenhum servidor RADIUS encontrado |

O status `not_found` **não é um erro de segurança** — indica apenas que o recurso não está em uso naquele ambiente.

---

## Alterações Necessárias

### 1. Adicionar Coluna no Banco de Dados

```sql
ALTER TABLE compliance_rules 
ADD COLUMN not_found_description TEXT;

COMMENT ON COLUMN compliance_rules.not_found_description IS 
  'Mensagem exibida quando os dados para avaliação não são encontrados (recurso não configurado)';
```

---

### 2. Atualizar Tipos TypeScript

**`src/types/complianceRule.ts`:**
```typescript
export interface ComplianceRuleDB {
  // ... campos existentes ...
  not_found_description: string | null;
}

export interface ComplianceRuleBasic {
  // ... campos existentes ...
  not_found_description: string | null;
}
```

---

### 3. Atualizar Formulário de Edição

**`src/components/admin/TemplateRulesManagement.tsx`:**

Adicionar campo ao form state:
```typescript
const [formData, setFormData] = useState({
  // ... campos existentes ...
  not_found_description: '',
});
```

Adicionar campo no formulário UI (ao lado de pass/fail descriptions):
```tsx
<div className="space-y-2">
  <Label htmlFor="not_found_description">Mensagem Não Encontrado</Label>
  <Input
    id="not_found_description"
    value={formData.not_found_description}
    onChange={(e) => setFormData({ ...formData, not_found_description: e.target.value })}
    placeholder="Ex: Nenhum servidor RADIUS configurado"
  />
  <p className="text-xs text-muted-foreground">
    Exibida quando o recurso não está configurado/em uso
  </p>
</div>
```

---

### 4. Atualizar RulePreviewCard

**`src/components/admin/RulePreviewCard.tsx`:**

Adicionar terceiro estado ao toggle:
```typescript
const [previewState, setPreviewState] = useState<'pass' | 'fail' | 'not_found'>('fail');

const statusConfig = {
  pass: { 
    icon: CheckCircle, 
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10 border-primary/30',
    label: 'Aprovado',
    message: rule.pass_description || 'Configuração conforme esperado'
  },
  fail: { 
    icon: XCircle, 
    iconClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
    label: 'Falha',
    message: rule.fail_description || 'Configuração fora do esperado'
  },
  not_found: { 
    icon: HelpCircle, // ou MinusCircle
    iconClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50 border-border',
    label: 'Não Encontrado',
    message: rule.not_found_description || 'Recurso não configurado neste ambiente'
  },
};
```

Adicionar terceiro botão no toggle:
```tsx
<div className="flex items-center gap-1 flex-shrink-0">
  <Button 
    size="sm" 
    variant={previewState === 'pass' ? 'default' : 'outline'}
    className="h-7 px-2 text-xs"
    onClick={() => setPreviewState('pass')}
  >
    Sucesso
  </Button>
  <Button 
    size="sm" 
    variant={previewState === 'fail' ? 'destructive' : 'outline'}
    className="h-7 px-2 text-xs"
    onClick={() => setPreviewState('fail')}
  >
    Falha
  </Button>
  <Button 
    size="sm" 
    variant={previewState === 'not_found' ? 'secondary' : 'outline'}
    className="h-7 px-2 text-xs"
    onClick={() => setPreviewState('not_found')}
  >
    N/A
  </Button>
</div>
```

Ajustar lógica de exibição:
- Seções de Risco Técnico e Impacto: **apenas em `fail`**
- Badge de severidade: **cores neutras em `pass` e `not_found`**
- Recomendação: **apenas em `fail`**

---

### 5. Diagrama Visual dos 3 Estados

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Estado: SUCESSO                                                            │
│  [✓] auth-002 • Servidor RADIUS Configurado    [Médio]  [Sucesso][Falha][N/A]│
│      Servidores RADIUS configurados com timeout adequado                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Estado: FALHA                                                              │
│  [✗] auth-002 • Servidor RADIUS Configurado    [Médio]  [Sucesso][Falha][N/A]│
│      Servidores RADIUS com timeout excessivo ou configuração insegura       │
│      → Reduza o timeout e configure servidores redundantes                  │
│                                                                             │
│      ▼ Ver detalhes do card                                                 │
│      ┌─────────────────────────────────────────────────────────────────┐    │
│      │ RISCO TÉCNICO: ...                                              │    │
│      │ IMPACTO NO NEGÓCIO: ...                                         │    │
│      └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Estado: NÃO ENCONTRADO                                                     │
│  [?] auth-002 • Servidor RADIUS Configurado    [Médio]  [Sucesso][Falha][N/A]│
│      Nenhum servidor RADIUS configurado neste ambiente                      │
│                                                                             │
│      (Sem seções de risco - não é uma falha de segurança)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. Popular Mensagens Existentes

Após criar a coluna, popular as mensagens para regras que fazem sentido ter estado "não encontrado":

```sql
-- Autenticação
UPDATE compliance_rules SET not_found_description = 'Nenhum servidor LDAP configurado' 
WHERE code = 'auth-001';

UPDATE compliance_rules SET not_found_description = 'Nenhum servidor RADIUS configurado' 
WHERE code = 'auth-002';

UPDATE compliance_rules SET not_found_description = 'Nenhum agente FSSO configurado' 
WHERE code = 'auth-003';

UPDATE compliance_rules SET not_found_description = 'Nenhum provedor SAML configurado' 
WHERE code = 'auth-004';

-- VPN
UPDATE compliance_rules SET not_found_description = 'Nenhum túnel VPN IPsec configurado' 
WHERE code = 'vpn-001';

-- HA (não aplicável - HA desabilitado é diferente de não encontrado)
-- Firmware, Licenciamento, etc. - não têm estado "não encontrado"
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar coluna `not_found_description` |
| `src/types/complianceRule.ts` | Adicionar campo aos tipos |
| `src/components/admin/TemplateRulesManagement.tsx` | Adicionar campo ao formulário |
| `src/components/admin/RulePreviewCard.tsx` | Adicionar terceiro estado ao toggle |

---

## Benefícios

- Clareza na diferenciação entre **falha de segurança** e **recurso não utilizado**
- Relatórios mais precisos que não geram falsos alertas
- Administrador pode customizar mensagem para cada cenário
- Consistência com o status `unknown` já existente no `ComplianceCard`
