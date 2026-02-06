
# Plano: Expansao Massiva para 60+ Verificacoes M365

## Situacao Atual

A Edge Function `m365-security-posture` possui **34 verificacoes** distribuidas em 6 categorias:
- **Identidades (IDT)**: 6 checks
- **Admin Privileges (ADM)**: 6 checks  
- **Auth Access (AUT)**: 7 checks
- **Apps Integrations (APP)**: 7 checks
- **Email Exchange (EXO)**: 5 checks
- **Threats Activity (THR)**: 5 checks

## Novas Verificacoes Disponiveis via Graph API

Baseado na pesquisa, existem **muitos endpoints adicionais** que podemos explorar:

---

### Categoria: Intune e Dispositivos (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| INT-001 | Dispositivos nao-compliance | `/deviceManagement/managedDevices?$filter=complianceState eq 'noncompliant'` | DeviceManagementManagedDevices.Read.All |
| INT-002 | Dispositivos sem encriptacao | `/deviceManagement/managedDevices?$select=isEncrypted` | DeviceManagementManagedDevices.Read.All |
| INT-003 | Dispositivos com jailbreak/root | `/deviceManagement/managedDevices?$filter=jailBroken eq 'True'` | DeviceManagementManagedDevices.Read.All |
| INT-004 | Dispositivos com SO desatualizado | `/deviceManagement/managedDevices?$select=osVersion` | DeviceManagementManagedDevices.Read.All |
| INT-005 | Politicas de compliance ausentes | `/deviceManagement/deviceCompliancePolicies` | DeviceManagementConfiguration.Read.All |
| INT-006 | Apps nao-gerenciados em dispositivos | `/deviceManagement/detectedApps` | DeviceManagementApps.Read.All |

---

### Categoria: SharePoint e OneDrive (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| SPO-001 | Sites com compartilhamento externo | `/sites?$select=sharingCapability` | Sites.Read.All |
| SPO-002 | Links de compartilhamento anonimos | `/sites/{id}/permissions` ou `/drives/{id}/root/permissions` | Sites.Read.All |
| SPO-003 | Sites sensiveis sem protecao | `/sites?$filter=sensitivity eq null` | Sites.Read.All |
| SPO-004 | OneDrive com compartilhamento amplo | `/users/{id}/drive/root/permissions` | Files.Read.All |

---

### Categoria: Teams e Colaboracao (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| TMS-001 | Teams com guests | `/groups?$filter=groupTypes/any(c:c eq 'Unified')&$expand=members` | Group.Read.All |
| TMS-002 | Teams publicos | `/teams?$filter=visibility eq 'public'` | Team.ReadBasic.All |
| TMS-003 | Teams sem owner | `/groups/{id}/owners` | Group.Read.All |
| TMS-004 | Canais privados com externos | `/teams/{id}/channels?$filter=membershipType eq 'private'` | Channel.ReadBasic.All |

---

### Categoria: Privileged Identity Management - PIM (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| PIM-001 | Roles elegiveis nao usadas | `/roleManagement/directory/roleEligibilityScheduleInstances` | RoleEligibilitySchedule.Read.Directory |
| PIM-002 | Ativacoes de role recentes | `/roleManagement/directory/roleAssignmentScheduleInstances` | RoleAssignmentSchedule.Read.Directory |
| PIM-003 | Roles sem politica de aprovacao | `/policies/roleManagementPolicies` | RoleManagementPolicy.Read.Directory |
| PIM-004 | Usuarios com roles permanentes vs elegiveis | Comparacao de roleAssignments | RoleManagement.Read.Directory |

---

### Categoria: Defender for Office 365 (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| DEF-001 | Safe Links desabilitado | `/security/threatAssessmentRequests` | ThreatAssessment.Read.All |
| DEF-002 | Safe Attachments desabilitado | Security & Compliance PowerShell* | N/A (requer PowerShell) |
| DEF-003 | Anti-phishing policy gaps | `/security/threatAssessmentRequests` | ThreatAssessment.Read.All |
| DEF-004 | Attack simulation results | `/security/attackSimulation/simulations` | AttackSimulation.Read.All |
| DEF-005 | Usuarios que cairam em phishing simulado | `/security/attackSimulation/simulations/{id}/report` | AttackSimulation.Read.All |

---

### Categoria: Information Protection e DLP (Nova)

| Codigo | Verificacao | Endpoint | Permissao |
|--------|-------------|----------|-----------|
| DLP-001 | Sensitivity labels definidos | `/informationProtection/policy/labels` | InformationProtectionPolicy.Read |
| DLP-002 | DLP policies configuradas | Microsoft Purview API* | N/A (requer Purview) |
| DLP-003 | Labels nao utilizados | Analise de uso de labels | InformationProtectionPolicy.Read |

---

### Expansao das Categorias Existentes

#### Identidades (IDT) - Adicoes

| Codigo | Verificacao | Endpoint |
|--------|-------------|----------|
| IDT-007 | Usuarios sincronizados do AD sem cloud-only | `/users?$filter=onPremisesSyncEnabled eq true` |
| IDT-008 | Usuarios com licencas atribuidas diretamente (vs grupo) | `/users/{id}/licenseDetails` |
| IDT-009 | Grupos dinamicos com regras arriscadas | `/groups?$filter=membershipRule ne null` |
| IDT-010 | Usuarios com manager nao definido | `/users?$filter=manager eq null` |

#### Admin Privileges (ADM) - Adicoes

| Codigo | Verificacao | Endpoint |
|--------|-------------|----------|
| ADM-007 | Emergency access accounts verificacao | Busca por contas "break glass" |
| ADM-008 | Roles custom criadas | `/roleManagement/directory/roleDefinitions?$filter=isBuiltIn eq false` |
| ADM-009 | Admins sem revisao de acesso configurada | `/identityGovernance/accessReviews/definitions` |

#### Auth Access (AUT) - Adicoes

| Codigo | Verificacao | Endpoint |
|--------|-------------|----------|
| AUT-008 | Named Locations configuradas | `/identity/conditionalAccess/namedLocations` |
| AUT-009 | Politicas de CA em modo report-only | `/identity/conditionalAccess/policies?$filter=state eq 'enabledForReportingButNotEnforced'` |
| AUT-010 | Session controls em CA | Analise de sessionControls em policies |
| AUT-011 | Continuous Access Evaluation (CAE) | `/identity/conditionalAccess/policies` com strictLocation |

#### Apps Integrations (APP) - Adicoes

| Codigo | Verificacao | Endpoint |
|--------|-------------|----------|
| APP-008 | Apps com reply URLs suspeitas | `/applications?$select=replyUrls` |
| APP-009 | Apps multi-tenant | `/applications?$filter=signInAudience eq 'AzureADMultipleOrgs'` |
| APP-010 | Apps com homepage URLs | `/applications?$select=web` |

---

## Arquitetura Proposta

Devido ao limite de tamanho do bundle, a implementacao sera:

### Opcao A: Coletores Inline Otimizados
Manter tudo em uma unica Edge Function com coletores inline compactos.

**Pros**: Simplicidade, uma unica chamada
**Contras**: Risco de timeout com muitas verificacoes

### Opcao B: Edge Functions Modulares (Recomendada)
Dividir em Edge Functions especializadas:

```
supabase/functions/
├── m365-security-posture/index.ts      # Orquestrador
├── m365-check-identity/index.ts        # IDT-001 a IDT-010
├── m365-check-admin/index.ts           # ADM-001 a ADM-009
├── m365-check-auth/index.ts            # AUT-001 a AUT-011
├── m365-check-apps/index.ts            # APP-001 a APP-010
├── m365-check-exchange/index.ts        # EXO-001 a EXO-005
├── m365-check-threats/index.ts         # THR-001 a THR-005
├── m365-check-intune/index.ts          # INT-001 a INT-006 (NOVO)
├── m365-check-sharepoint/index.ts      # SPO-001 a SPO-004 (NOVO)
├── m365-check-teams/index.ts           # TMS-001 a TMS-004 (NOVO)
├── m365-check-pim/index.ts             # PIM-001 a PIM-004 (NOVO)
└── m365-check-defender/index.ts        # DEF-001 a DEF-005 (NOVO)
```

O orquestrador chama todas as functions em paralelo e consolida.

---

## Permissoes Graph API Adicionais Necessarias

Para as novas verificacoes, o App Registration precisara de:

| Permissao | Uso |
|-----------|-----|
| DeviceManagementManagedDevices.Read.All | Intune devices |
| DeviceManagementConfiguration.Read.All | Compliance policies |
| Sites.Read.All | SharePoint sites |
| Files.Read.All | OneDrive permissions |
| Team.ReadBasic.All | Teams info |
| Channel.ReadBasic.All | Channels info |
| RoleEligibilitySchedule.Read.Directory | PIM eligible roles |
| RoleManagementPolicy.Read.Directory | PIM policies |
| AttackSimulation.Read.All | Defender simulations |
| InformationProtectionPolicy.Read | Sensitivity labels |

---

## Ordem de Implementacao

### Fase 1: Intune (6 checks)
Mais facil de implementar, alto valor para compliance de dispositivos.

### Fase 2: PIM (4 checks)
Muito importante para Zero Trust e least privilege.

### Fase 3: SharePoint/OneDrive (4 checks)
Data protection e compartilhamento.

### Fase 4: Teams (4 checks)
Colaboracao e guests.

### Fase 5: Defender + DLP (8 checks)
Alguns dependem de licencas especificas.

---

## Verificacoes Finais por Categoria

| Categoria | Atual | Novas | Total |
|-----------|-------|-------|-------|
| Identidades | 6 | 4 | 10 |
| Admin Privileges | 6 | 3 | 9 |
| Auth Access | 7 | 4 | 11 |
| Apps Integrations | 7 | 3 | 10 |
| Email Exchange | 5 | 0 | 5 |
| Threats Activity | 5 | 0 | 5 |
| **Intune (NOVO)** | 0 | 6 | 6 |
| **SharePoint (NOVO)** | 0 | 4 | 4 |
| **Teams (NOVO)** | 0 | 4 | 4 |
| **PIM (NOVO)** | 0 | 4 | 4 |
| **Defender (NOVO)** | 0 | 5 | 5 |
| **TOTAL** | **34** | **37** | **73** |

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/m365-security-posture/index.ts` | Refatorar como orquestrador |
| `supabase/functions/m365-check-intune/index.ts` | Criar (INT-001 a INT-006) |
| `supabase/functions/m365-check-sharepoint/index.ts` | Criar (SPO-001 a SPO-004) |
| `supabase/functions/m365-check-teams/index.ts` | Criar (TMS-001 a TMS-004) |
| `supabase/functions/m365-check-pim/index.ts` | Criar (PIM-001 a PIM-004) |
| `supabase/functions/m365-check-defender/index.ts` | Criar (DEF-001 a DEF-005) |
| `src/types/m365Insights.ts` | Adicionar novas categorias |
| `src/pages/m365/M365PosturePage.tsx` | Adicionar cards das novas categorias |

---

## Resultado Esperado

- **Antes**: 34 verificacoes em 6 categorias
- **Depois**: 73 verificacoes em 11 categorias
- Cobertura completa do ambiente M365
- Score muito mais preciso e representativo
- Dashboard com visibilidade de Intune, SharePoint, Teams, PIM
- Posicao competitiva com ferramentas como Microsoft Secure Score
