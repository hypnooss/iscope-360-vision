
# Plano: Preencher Guia de Correções e Ajustar PDF

## Situação Atual

### Banco de Dados (`rule_correction_guides`)
| Status | Quantidade | Regras |
|--------|------------|--------|
| Com guia completo | 17 | DKIM-001, DKIM-002, DMARC-001/002/003, SPF-001/002/003, MX-001/002, DNS-001/002/003/004/005/006 |
| Sem guia | 6 | DKIM-003, DMARC-004/005/006, MX-003/004/005 |

### PDF (`ExternalDomainPDF.tsx`)
- Já recebe `correctionGuides` como prop
- Já implementa `getGuideContent()` com fallback para `explanatoryContent.ts`
- Busca dados em `ExternalDomainAnalysisReportPage.tsx`

---

## Etapa 1: Preencher Textos Faltantes (6 regras)

### DKIM-003 - Redundância DKIM
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Múltiplos seletores DKIM',
  'Ter mais de um seletor DKIM configurado para garantir continuidade caso um precise ser rotacionado.',
  'Com apenas um seletor DKIM, a rotação de chaves pode causar falhas temporárias na autenticação de emails.',
  '["Interrupção na autenticação durante rotação de chaves", "Emails podem falhar verificação DKIM temporariamente", "Dificuldade em migrar para novas chaves"]'::jsonb,
  '["Acesse o painel do seu provedor de email (Google Workspace, Microsoft 365)", "Gere um segundo seletor DKIM com nome diferente (ex: google2, selector2)", "Adicione o novo registro DKIM no DNS mantendo o anterior ativo", "Teste ambos os seletores antes de desativar o antigo"]'::jsonb,
  'medium',
  '45 min',
  '["Google Workspace", "Microsoft 365", "Zoho Mail"]'::jsonb
FROM compliance_rules WHERE code = 'DKIM-003' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### DMARC-004 - Cobertura DMARC Total
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Cobertura total do DMARC',
  'Configurar o DMARC para que 100% dos emails passem pela verificação (pct=100).',
  'Com cobertura parcial, apenas uma porcentagem dos emails é verificada, deixando brechas para ataques.',
  '["Emails fraudulentos podem passar sem verificação", "Proteção incompleta contra phishing", "Falsa sensação de segurança"]'::jsonb,
  '["Acesse o registro DMARC no seu DNS", "Localize o parâmetro pct= (se existir)", "Remova o parâmetro pct ou altere para pct=100", "Valor padrão já é 100%, então remover é suficiente"]'::jsonb,
  'low',
  '10 min',
  '["Cloudflare", "Registro.br", "GoDaddy"]'::jsonb
FROM compliance_rules WHERE code = 'DMARC-004' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### DMARC-005 - Alinhamento SPF Estrito
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Alinhamento SPF rigoroso',
  'Exigir que o domínio do envelope (Return-Path) seja idêntico ao domínio do From, não apenas do mesmo domínio pai.',
  'Alinhamento relaxado permite que subdomínios passem pela verificação, o que pode ser explorado por atacantes.',
  '["Subdomínios não autorizados podem passar na verificação", "Menor proteção contra spoofing sofisticado", "Possível exploração via subdomínios"]'::jsonb,
  '["Edite o registro DMARC no DNS", "Adicione ou altere o parâmetro aspf=s (strict)", "Exemplo: v=DMARC1; p=reject; aspf=s; adkim=s", "Teste antes para garantir que emails legítimos não serão bloqueados"]'::jsonb,
  'low',
  '15 min',
  '["Cloudflare", "Registro.br", "GoDaddy"]'::jsonb
FROM compliance_rules WHERE code = 'DMARC-005' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### DMARC-006 - Alinhamento DKIM Estrito
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Alinhamento DKIM rigoroso',
  'Exigir que o domínio na assinatura DKIM seja idêntico ao domínio do From, não apenas do mesmo domínio pai.',
  'Alinhamento relaxado permite que emails assinados por subdomínios passem, reduzindo a eficácia da proteção.',
  '["Assinaturas de subdomínios podem validar emails do domínio principal", "Menor granularidade na verificação", "Possível bypass via subdomínios comprometidos"]'::jsonb,
  '["Edite o registro DMARC no DNS", "Adicione ou altere o parâmetro adkim=s (strict)", "Exemplo: v=DMARC1; p=reject; aspf=s; adkim=s", "Verifique se todos os emails legítimos usam DKIM do domínio correto"]'::jsonb,
  'low',
  '15 min',
  '["Cloudflare", "Registro.br", "GoDaddy"]'::jsonb
FROM compliance_rules WHERE code = 'DMARC-006' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### MX-003 - Prioridades MX Configuradas
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Prioridades dos servidores de email',
  'Cada registro MX tem uma prioridade que define a ordem de tentativa de entrega de emails.',
  'Sem prioridades corretas, emails podem ser enviados para servidores errados ou backup antes do principal.',
  '["Emails podem ir para servidor secundário desnecessariamente", "Sobrecarga no servidor de backup", "Atrasos na entrega de emails"]'::jsonb,
  '["Acesse o painel DNS do seu domínio", "Verifique os registros MX existentes", "Configure prioridades diferentes (10, 20, 30, etc.)", "Menor número = maior prioridade (servidor principal deve ter menor valor)"]'::jsonb,
  'low',
  '15 min',
  '["Cloudflare", "Registro.br", "GoDaddy"]'::jsonb
FROM compliance_rules WHERE code = 'MX-003' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### MX-004 - MX Aponta para Hostname
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'MX deve apontar para hostname',
  'Registros MX devem apontar para nomes de host (FQDN), nunca diretamente para endereços IP.',
  'Apontar MX para IP viola as especificações de email (RFC) e pode causar problemas de entrega.',
  '["Violação das especificações de email (RFC 5321)", "Alguns servidores podem rejeitar emails", "Problemas de compatibilidade com serviços de email"]'::jsonb,
  '["Verifique se seus registros MX apontam para IPs", "Crie registros A para os servidores de email", "Altere os MX para apontar para hostnames (ex: mail.seudominio.com.br)", "Nunca use IPs diretamente em registros MX"]'::jsonb,
  'low',
  '20 min',
  '["Cloudflare", "Registro.br", "GoDaddy"]'::jsonb
FROM compliance_rules WHERE code = 'MX-004' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

### MX-005 - Contato Administrativo DNS
```sql
INSERT INTO rule_correction_guides (rule_id, friendly_title, what_is, why_matters, impacts, how_to_fix, difficulty, time_estimate, provider_examples)
SELECT id,
  'Email de contato no DNS',
  'O registro SOA contém um email de contato administrativo para o domínio.',
  'Este email é usado para notificações importantes sobre o domínio, como problemas de DNS ou segurança.',
  '["Não receber alertas críticos sobre o domínio", "Dificuldade de contato em caso de problemas", "Pode afetar resolução de disputas de domínio"]'::jsonb,
  '["Verifique o registro SOA do seu domínio", "O campo RNAME/contact deve conter um email válido", "Formato: admin.seudominio.com.br (@ é substituído por ponto)", "Contate seu provedor DNS se precisar alterar"]'::jsonb,
  'low',
  '15 min',
  '["Cloudflare", "Registro.br", "AWS Route 53"]'::jsonb
FROM compliance_rules WHERE code = 'MX-005' AND device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain');
```

---

## Etapa 2: Verificar Integração PDF

O código já está correto! Em `ExternalDomainPDF.tsx`:

```typescript
// Helper já implementado corretamente
const getGuideContent = (
  ruleId: string,
  correctionGuides: CorrectionGuideData[] | undefined,
  fallbackName?: string,
  fallbackDescription?: string,
  fallbackRecommendation?: string
): ExplanatoryContent => {
  // Primeiro tenta buscar no banco
  const dbGuide = correctionGuides?.find(g => g.rule_code === ruleId);
  
  if (dbGuide && dbGuide.friendly_title) {
    return {
      friendlyTitle: dbGuide.friendly_title || fallbackName || ruleId,
      whatIs: dbGuide.what_is || fallbackDescription,
      whyMatters: dbGuide.why_matters || '...',
      impacts: dbGuide.impacts || [],
      howToFix: dbGuide.how_to_fix || [],
      difficulty: dbGuide.difficulty || 'medium',
      timeEstimate: dbGuide.time_estimate || '30 min',
      providerExamples: dbGuide.provider_examples || undefined,
    };
  }
  
  // Fallback para arquivo hardcoded
  return getExplanatoryContent(ruleId, fallbackName, fallbackDescription, fallbackRecommendation);
};
```

E em `ExternalDomainAnalysisReportPage.tsx`:

```typescript
// Já busca os guias do banco antes de gerar o PDF
const { data: correctionGuides } = useQuery({
  queryKey: ['correction-guides-pdf', deviceTypeId],
  queryFn: async () => {
    const { data } = await supabase
      .from('rule_correction_guides')
      .select('*, compliance_rules!inner(code, device_type_id)')
      .eq('compliance_rules.device_type_id', deviceTypeId);
    return data?.map(g => ({
      rule_code: g.compliance_rules.code,
      friendly_title: g.friendly_title,
      ...
    }));
  },
});
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_populate_correction_guides.sql` | **Criar** - Inserir os 7 guias faltantes |

**Nenhuma alteração de código necessária** - a integração já está pronta.

---

## Resultado Esperado

### Antes
- 17 de 23 regras com guia configurado (74%)
- 6 regras usando fallback do `explanatoryContent.ts`

### Depois
- 23 de 23 regras com guia configurado (100%)
- PDF usará exclusivamente dados do banco de dados
- Administradores podem editar todos os textos via interface

---

## Seção Técnica

### Estrutura da Tabela `rule_correction_guides`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `friendly_title` | text | Título amigável para o PDF |
| `what_is` | text | Seção "O que é" |
| `why_matters` | text | Seção "Por que importa" |
| `impacts` | jsonb[] | Lista de impactos possíveis |
| `how_to_fix` | jsonb[] | Passos para correção |
| `provider_examples` | jsonb[] | Exemplos de provedores (opcional) |
| `difficulty` | text | 'low', 'medium', 'high' |
| `time_estimate` | text | Tempo estimado (ex: "15 min") |

### Fluxo de Dados
```text
[Administração > Templates > Guia de Correções]
                    ↓
         [rule_correction_guides]
                    ↓
  [ExternalDomainAnalysisReportPage.tsx]
         (useQuery → correctionGuides)
                    ↓
      [ExternalDomainPDF.tsx]
       (getGuideContent → prioriza banco)
                    ↓
         [PDFExplanatoryCard]
```
