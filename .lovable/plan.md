
## Ajustes nas Abas Blueprints, Regras e Parses

### Resumo das Necessidades

1. **Parses não exibe nada** - A tabela `evidence_parses` está vazia e precisa ser populada com os dados do `EvidenceDisplay.tsx`
2. **Proteção de exclusão** - Impedir exclusão de itens que possuem vínculos ativos
3. **Melhorias visuais** - Adicionar contagem de parses na aba

---

### Parte 1: Popular Tabela `evidence_parses`

A tabela está criada mas vazia. Preciso migrar os dados hardcoded do `EvidenceDisplay.tsx`:

**SQL Migration para popular dados:**

```sql
-- Obter o device_type_id de external_domain
WITH ext_domain AS (
  SELECT id FROM device_types WHERE code = 'external_domain' LIMIT 1
)
INSERT INTO evidence_parses (device_type_id, source_field, display_label, parse_type, value_transformations, is_active, display_order)
SELECT 
  ext_domain.id,
  source_field,
  display_label,
  parse_type::parse_type,
  value_transformations::jsonb,
  true,
  display_order
FROM ext_domain, (VALUES
  -- DNSSEC Status
  ('data.has_dnskey', 'Status DNSSEC', 'boolean', '{"true": "DNSSEC Ativado", "false": "DNSSEC Desativado"}', 0),
  ('data.has_ds', 'Registro DS', 'boolean', '{"true": "Presente", "false": "Ausente"}', 1),
  ('data.validated', 'Validação DNSSEC', 'boolean', '{"true": "Validação OK", "false": "Não validado"}', 2),
  -- SOA
  ('data.mname', 'Servidor Primário', 'text', '{}', 3),
  ('data.rname', 'Email do Responsável', 'text', '{}', 4),
  ('data.contact_email', 'Contato do Administrador', 'text', '{}', 5),
  ('data.refresh', 'Tempo de Refresh', 'time', '{}', 6),
  ('data.retry', 'Tempo de Retry', 'time', '{}', 7),
  ('data.expire', 'Tempo de Expiração', 'time', '{}', 8),
  ('data.minimum', 'TTL Mínimo', 'time', '{}', 9),
  ('data.serial', 'Número Serial', 'number', '{}', 10),
  -- SPF
  ('data.raw', 'Registro SPF/DMARC', 'text', '{}', 11),
  ('data.parsed.includes', 'Mecanismos Include', 'list', '{}', 12),
  ('data.parsed.all', 'Política ALL', 'text', '{}', 13),
  -- DKIM
  ('data.found', 'Registros DKIM', 'list', '{}', 14),
  -- DMARC
  ('data.parsed.p', 'Política DMARC', 'text', '{"reject": "Rejeitar", "quarantine": "Quarentena", "none": "Nenhuma"}', 15),
  ('data.parsed.sp', 'Política de Subdomínio', 'text', '{"reject": "Rejeitar", "quarantine": "Quarentena", "none": "Nenhuma"}', 16),
  ('data.parsed.aspf', 'Alinhamento SPF', 'text', '{"r": "Relaxado", "s": "Estrito"}', 17),
  ('data.parsed.adkim', 'Alinhamento DKIM', 'text', '{"r": "Relaxado", "s": "Estrito"}', 18),
  ('data.parsed.pct', 'Cobertura', 'number', '{"100": "100% (total)"}', 19),
  ('data.parsed.rua', 'Relatórios (RUA)', 'text', '{}', 20),
  ('data.parsed.ruf', 'Relatórios Forenses (RUF)', 'text', '{}', 21),
  -- Nameservers/MX
  ('data.records', 'Registros', 'list', '{}', 22)
) AS v(source_field, display_label, parse_type, value_transformations, display_order);
```

---

### Parte 2: Proteção de Exclusão (Vínculos)

Implementar verificação antes de permitir exclusão para evitar quebrar fluxos de análise ativos.

#### Lógica de Vínculos

| Item a Excluir | Verificar Vínculo |
|----------------|-------------------|
| **Blueprint** | Se é o único blueprint ativo do device_type |
| **Regra** | Se está referenciada em relatórios (`analysis_history`, `external_domain_analysis_history`) |
| **Parse** | Se está vinculada a alguma regra ativa (via `source_field` no `evaluation_logic`) |

#### Modificações nos Componentes

**1. `BlueprintsTable.tsx`**
```typescript
const handleDelete = async () => {
  if (!selectedBlueprint) return;
  
  // Verificar se é o único blueprint ativo
  const activeBlueprintsCount = blueprints.filter(bp => bp.is_active).length;
  if (selectedBlueprint.is_active && activeBlueprintsCount === 1) {
    toast.error('Não é possível excluir o único blueprint ativo. Crie outro blueprint ativo primeiro.');
    return;
  }
  
  // Prosseguir com exclusão...
};
```

**2. `ComplianceRulesTable.tsx`**
```typescript
const handleDelete = async () => {
  if (!selectedRule) return;
  
  // Verificar se há análises usando esta regra
  const { count } = await supabase
    .from('external_domain_analysis_history')
    .select('id', { count: 'exact', head: true })
    .filter('report_data->results', 'cs', `[{"code":"${selectedRule.code}"}]`);
  
  if (count && count > 0) {
    toast.error(`Não é possível excluir: ${count} análise(s) usam esta regra.`);
    return;
  }
  
  // Prosseguir com exclusão...
};
```

**3. `ParsesManagement.tsx`**
```typescript
const handleDelete = async () => {
  if (!selectedParse) return;
  
  // Verificar se alguma regra usa este campo no evaluation_logic
  const { data: rulesUsingParse } = await supabase
    .from('compliance_rules')
    .select('code, name')
    .eq('device_type_id', deviceTypeId)
    .filter('evaluation_logic', 'cs', `{"field":"${selectedParse.source_field}"}`);
  
  if (rulesUsingParse && rulesUsingParse.length > 0) {
    toast.error(`Parse em uso por ${rulesUsingParse.length} regra(s): ${rulesUsingParse.map(r => r.code).join(', ')}`);
    return;
  }
  
  // Prosseguir com exclusão...
};
```

---

### Parte 3: Adicionar Contagem de Parses na Aba

Atualmente a aba Parses não mostra contagem. Adicionar badge como nas outras abas.

**Modificação em `DeviceTypeCard.tsx`:**

```typescript
// Estado para contar parses
const [parsesCount, setParsesCount] = useState(0);

// Buscar contagem de parses
useEffect(() => {
  const fetchParsesCount = async () => {
    const { count } = await supabase
      .from('evidence_parses')
      .select('*', { count: 'exact', head: true })
      .eq('device_type_id', deviceType.id);
    setParsesCount(count || 0);
  };
  fetchParsesCount();
}, [deviceType.id]);

// Na TabsTrigger de Parses:
<TabsTrigger value="parses" className="gap-2">
  <Languages className="w-4 h-4" />
  Parses
  <Badge variant="outline" className="ml-1 text-xs">{parsesCount}</Badge>
</TabsTrigger>
```

---

### Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| **Migration SQL** | Popular `evidence_parses` com dados do EvidenceDisplay.tsx |
| `src/components/admin/DeviceTypeCard.tsx` | Adicionar contagem de parses na aba |
| `src/components/admin/BlueprintsTable.tsx` | Impedir exclusão do único blueprint ativo |
| `src/components/admin/ComplianceRulesTable.tsx` | Verificar uso em análises antes de excluir |
| `src/components/admin/ParsesManagement.tsx` | Verificar uso em regras antes de excluir |

---

### Benefícios

1. **Parses funcionando** - Dados reais no banco para visualização e gestão
2. **Proteção de integridade** - Impede exclusão acidental de itens em uso
3. **Feedback claro** - Mensagens explicando por que não pode excluir
4. **Contagem visível** - Parses mostra quantidade como outras abas
