
# Criar Template M365 e Migrar Dados Hardcoded para Banco de Dados

## Visao Geral

O modulo Microsoft 365 possui mais de 50 verificacoes de seguranca (insights) hardcoded diretamente nas Edge Functions. Este plano cria um template M365 no sistema de templates existente e prepara a infraestrutura para que essas verificacoes sejam gerenciadas via banco de dados, assim como ja acontece com Firewall e Dominio Externo.

## Inventario de Verificacoes Existentes (Hardcoded)

Foram identificadas 57 verificacoes distribuidas em 11 categorias:

| Categoria | Codigo | Verificacoes |
|-----------|--------|--------------|
| Identidades | IDT-001 a IDT-006 | MFA, Usuarios inativos, Guests problematicos, Guests inativos, Senhas antigas, Contas desabilitadas |
| Privilegios Admin | ADM-001 a ADM-006 | Global Admins, MFA admins, Total privilegiados, Multi-role, Guests admin, SP admins |
| Autenticacao | AUT-001 a AUT-007 | Security Defaults, Conditional Access, Risky sign-ins, Risky users, Auth methods, Named locations |
| Apps | APP-001 a APP-007 | Credenciais expirando, Credenciais expiradas, Permissoes elevadas, Apps sem owner, OAuth consents, SPs, Total apps |
| Email/Exchange | EXO-001 a EXO-005 | Forwarding externo, Forwarding interno, Auto-replies, Mailboxes, Delegacoes |
| Ameacas | THR-001 a THR-005 | Alertas seguranca, Sign-ins pais, Sign-ins falha, Atividades sensiveis, Secure Score |
| Intune | INT-001 a INT-006 | Dispositivos nao-compliance, Sem criptografia, Jailbreak, SO desatualizado, Politicas compliance, Apps arriscados |
| PIM | PIM-001 a PIM-004 | Roles elegiveis, Ativacoes recentes, Sem aprovacao, Permanente vs Elegivel |
| SharePoint | SPO-001 a SPO-006 | External sharing, Sites compartilhados, Sites sem owner, OneDrive sharing, Quotas, Sites inativos |
| Teams | TMS-001 a TMS-004 | Teams com guests, Teams publicos, Teams sem owner, Canais privados |
| Defender | DEF-001 a DEF-005 | Alertas ativos, Incidentes, Simulacoes phishing, Secure Score, Labels DLP |

## Plano de Implementacao

### Fase 1: Criar Template M365 no Banco

**1.1 Criar device_type para M365**
- code: `m365`
- name: `Microsoft 365`
- vendor: `Microsoft`
- category: `other` (nova categoria `cloud` seria ideal, mas usamos `other` por compatibilidade)
- icon: `Cloud`

**1.2 Criar 11 rule_categories para M365**
Cada categoria de risco do M365 sera uma categoria de regras:

```text
| name | display_name | icon | color | order |
|------|--------------|------|-------|-------|
| identities | Identidades | Users | blue-500 | 1 |
| auth_access | Autenticacao & Acesso | KeyRound | purple-500 | 2 |
| admin_privileges | Privilegios Administrativos | Crown | amber-500 | 3 |
| apps_integrations | Aplicacoes & Integracoes | Blocks | cyan-500 | 4 |
| email_exchange | Email & Exchange | Mail | indigo-500 | 5 |
| threats_activity | Ameacas & Atividades | AlertTriangle | red-500 | 6 |
| intune_devices | Intune & Dispositivos | Smartphone | green-500 | 7 |
| pim_governance | PIM & Governanca | ShieldCheck | orange-500 | 8 |
| sharepoint_onedrive | SharePoint & OneDrive | HardDrive | teal-500 | 9 |
| teams_collaboration | Teams & Colaboracao | MessageSquare | violet-500 | 10 |
| defender_security | Defender & DLP | Shield | rose-500 | 11 |
```

**1.3 Criar 57 compliance_rules para M365**
Cada verificacao sera uma regra com:
- code: Ex: `IDT-001`, `ADM-002`
- name: Titulo da verificacao
- category: Nome da categoria correspondente
- severity: critical/high/medium/low/info
- api_endpoint: Endpoint Graph API usado
- pass_description: Mensagem quando passa
- fail_description: Mensagem quando falha
- recommendation: Passos de remediacao
- technical_risk: Risco tecnico
- business_impact: Impacto no negocio
- evaluation_logic: JSON com regras de avaliacao (adaptado do formato existente)

### Fase 2: Migracao dos Dados

Executar SQL de migracao que cria:
1. O device_type M365
2. As 11 categorias
3. As 57 regras de compliance

### Fase 3: Ajustar Edge Functions (Futuro)

Modificar as Edge Functions para:
1. Carregar regras do banco de dados
2. Usar as descricoes/textos do banco em vez de hardcoded
3. Manter a logica de avaliacao nas functions (por ser especifica da Graph API)

Esta fase e mais complexa e pode ser feita incrementalmente.

### Fase 4: Atualizar Frontend (Futuro)

Ajustar a pagina de Postura M365 para:
1. Carregar categorias do banco (rule_categories)
2. Usar textos das regras (compliance_rules)
3. Permitir edicao via Templates (como ja funciona para Firewall)

---

## Detalhes Tecnicos

### SQL de Migracao

A migracao ira:

1. **Inserir device_type M365:**
```sql
INSERT INTO device_types (code, name, vendor, category, icon, is_active)
VALUES ('m365', 'Microsoft 365', 'Microsoft', 'other', 'Cloud', true);
```

2. **Inserir 11 rule_categories:**
```sql
INSERT INTO rule_categories (device_type_id, name, icon, color, display_order, is_active)
SELECT dt.id, 'identities', 'Users', 'blue-500', 1, true
FROM device_types dt WHERE dt.code = 'm365';
-- ... (repetir para as 11 categorias)
```

3. **Inserir 57 compliance_rules:**
Cada regra extraida das Edge Functions com todos os campos preenchidos.

### Mapeamento de Campos

| Campo Edge Function | Campo compliance_rules |
|---------------------|----------------------|
| id/code | code |
| titulo | name |
| category | category |
| severity | severity |
| descricaoExecutiva (template) | pass_description/fail_description |
| riscoTecnico | technical_risk |
| impactoNegocio | business_impact |
| remediacao.passosDetalhados | recommendation |
| endpointUsado | api_endpoint |
| scoreImpacto | weight |

### Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar device_type, rule_categories e compliance_rules |
| `src/pages/admin/TemplatesPage.tsx` | Nenhuma mudanca necessaria (ja suporta novos device_types) |
| `src/pages/admin/TemplateDetailPage.tsx` | Nenhuma mudanca necessaria (ja suporta novos device_types) |

### Observacoes Importantes

1. **Separacao de Responsabilidades:** A logica de coleta (Graph API calls) permanece nas Edge Functions. O banco armazena apenas metadados (textos, configuracoes de UI).

2. **Compatibilidade:** O sistema de templates ja suporta novos device_types. Ao criar o device_type M365, ele automaticamente aparecera na lista de templates.

3. **Incrementalidade:** A migracao dos textos hardcoded para o banco pode ser feita gradualmente. Inicialmente criamos a estrutura, depois ajustamos as Edge Functions para consumir os dados.

4. **Nao ha blueprint para M365:** Diferente de Firewall (que usa agent com blueprints), o M365 coleta diretamente via Graph API. O campo `device_blueprints` ficara vazio para M365.
