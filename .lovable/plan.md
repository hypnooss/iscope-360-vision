

# Plano: Adicionar Métricas Estratégicas do Ambiente M365

## Objetivo

Implementar a coleta e exibição de informações estratégicas do ambiente Microsoft 365 conforme solicitado no plano editado:

- Tipo de autenticação (Cloud only / Hybrid / Federation)
- Nº total de usuários (ativos, inativos, convidados)
- Apps registradas (Enterprise Apps / App Registrations)
- Storage total usado
- MFA Status (% com MFA)
- Conditional Access Status (ativo/inativo)
- Origem Autenticação (países - se disponível)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Adicionar coletor de métricas do ambiente |
| `src/pages/m365/M365PostureReportPage.tsx` | Atualizar painel direito com novas métricas |

---

## Parte 1: Edge Function - Coletor de Métricas do Ambiente

Adicionar uma nova função `collectEnvironmentMetrics` que faz chamadas à Microsoft Graph API para coletar:

```tsx
async function collectEnvironmentMetrics(accessToken: string): Promise<EnvironmentMetrics> {
  const metrics: EnvironmentMetrics = {
    // Identidade
    authType: 'cloud_only',        // Cloud Only | Hybrid | Federated
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    guestUsers: 0,
    
    // Autenticação
    mfaEnabledPercent: 0,
    conditionalAccessEnabled: false,
    conditionalAccessPoliciesCount: 0,
    securityDefaultsEnabled: false,
    
    // Aplicações
    enterpriseAppsCount: 0,
    appRegistrationsCount: 0,
    
    // Storage (SharePoint)
    storageUsedGB: 0,
    storageTotalGB: 0,
    
    // Países de login (últimos 7 dias)
    loginCountries: [],
  };

  // 1. Organization info (detectar Hybrid/Federation)
  const { data: orgData } = await graphFetchSafe(accessToken, '/organization');
  if (orgData?.value?.[0]) {
    const org = orgData.value[0];
    if (org.onPremisesSyncEnabled) {
      metrics.authType = 'hybrid';
    }
    // Verificar federation via domains
  }

  // 2. Contagem de usuários
  const { data: usersCount } = await graphFetchSafe(accessToken, '/users/$count', { consistency: true });
  metrics.totalUsers = typeof usersCount === 'number' ? usersCount : 0;

  const { data: activeCount } = await graphFetchSafe(accessToken, '/users/$count?$filter=accountEnabled eq true', { consistency: true });
  metrics.activeUsers = typeof activeCount === 'number' ? activeCount : 0;

  const { data: guestsCount } = await graphFetchSafe(accessToken, '/users/$count?$filter=userType eq \'Guest\'', { consistency: true });
  metrics.guestUsers = typeof guestsCount === 'number' ? guestsCount : 0;

  metrics.disabledUsers = metrics.totalUsers - metrics.activeUsers;

  // 3. MFA Status (já coletado em IDT-001, reutilizar)
  // Extrair do insight IDT-001 após coleta

  // 4. Conditional Access
  const { data: caData } = await graphFetchSafe(accessToken, '/identity/conditionalAccess/policies');
  if (caData?.value) {
    const enabled = caData.value.filter((p: any) => p.state === 'enabled');
    metrics.conditionalAccessEnabled = enabled.length > 0;
    metrics.conditionalAccessPoliciesCount = enabled.length;
  }

  // 5. Security Defaults
  const { data: secDefaults } = await graphFetchSafe(accessToken, '/policies/identitySecurityDefaultsEnforcementPolicy');
  metrics.securityDefaultsEnabled = secDefaults?.isEnabled === true;

  // 6. Aplicações
  const { data: appsCount } = await graphFetchSafe(accessToken, '/applications/$count', { consistency: true });
  metrics.appRegistrationsCount = typeof appsCount === 'number' ? appsCount : 0;

  const { data: spCount } = await graphFetchSafe(accessToken, '/servicePrincipals/$count', { consistency: true });
  metrics.enterpriseAppsCount = typeof spCount === 'number' ? spCount : 0;

  // 7. SharePoint Storage (requer permissões específicas)
  const { data: spSites } = await graphFetchSafe(accessToken, '/sites/root?$select=id');
  // Storage detalhado requer admin API

  // 8. Países de login (sign-in logs)
  const { data: signIns } = await graphFetchSafe(
    accessToken, 
    '/auditLogs/signIns?$select=location&$top=500',
    { beta: true }
  );
  if (signIns?.value) {
    const countries = new Map<string, number>();
    signIns.value.forEach((s: any) => {
      const country = s.location?.countryOrRegion;
      if (country) {
        countries.set(country, (countries.get(country) || 0) + 1);
      }
    });
    metrics.loginCountries = Array.from(countries.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return metrics;
}
```

Retornar no response da edge function:

```tsx
return new Response(JSON.stringify({
  success: true,
  score,
  classification,
  summary,
  categoryBreakdown,
  insights: allInsights,
  environmentMetrics, // NOVO
  errors: allErrors.length > 0 ? allErrors : undefined,
  tenant: { ... },
  analyzedAt: now,
}), ...);
```

---

## Parte 2: Frontend - Atualizar Painel Direito

Reorganizar o painel direito do Command Center para exibir as métricas estratégicas:

```
┌─────────────────────────────────────────────┐
│ DOMÍNIO        aggroupbr.onmicrosoft.com   │
│ TIPO AUTH      Cloud Only | Hybrid         │
│ ─────────────────────────────────────────── │
│ USUÁRIOS       436 (12 inativos, 119 guests)│
│ APLICAÇÕES     Enterprise: 45 | Apps: 23   │
│ ─────────────────────────────────────────── │
│ MFA            76% habilitado              │
│ COND. ACCESS   ✓ 5 políticas ativas        │
│ ─────────────────────────────────────────── │
│ TOP PAÍSES     🇧🇷 BR (320) 🇺🇸 US (45)     │
└─────────────────────────────────────────────┘
```

Código do painel:

```tsx
// Extrair métricas do ambiente (vindo da API ou fallback do parse)
const envMetrics = reportData.environmentMetrics || extractedMetrics;

{/* Right Panel: Environment Info */}
<div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8 space-y-1.5">
  
  {/* Identity Block */}
  <DetailRow label="Domínio" value={displayInfo.tenant_domain} highlight />
  <DetailRow 
    label="Tipo Auth" 
    value={
      envMetrics.authType === 'hybrid' ? 'Hybrid (AD Connect)' :
      envMetrics.authType === 'federated' ? 'Federation (ADFS)' :
      'Cloud Only'
    } 
  />
  
  <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-2" />
  
  {/* Users Block */}
  <DetailRow 
    label="Usuários" 
    value={`${envMetrics.activeUsers} ativos`}
    subValue={`${envMetrics.disabledUsers} inativos, ${envMetrics.guestUsers} guests`}
  />
  <DetailRow 
    label="Aplicações" 
    value={`Enterprise: ${envMetrics.enterpriseAppsCount} | Apps: ${envMetrics.appRegistrationsCount}`}
  />
  
  <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-2" />
  
  {/* Security Block */}
  <DetailRow 
    label="MFA" 
    value={`${envMetrics.mfaEnabledPercent}% habilitado`}
    indicator={envMetrics.mfaEnabledPercent >= 80 ? "success" : "warning"}
  />
  <DetailRow 
    label="Cond. Access" 
    value={envMetrics.conditionalAccessEnabled 
      ? `✓ ${envMetrics.conditionalAccessPoliciesCount} política(s)` 
      : '✗ Não configurado'}
    indicator={envMetrics.conditionalAccessEnabled ? "success" : "error"}
  />
  
  <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-2" />
  
  {/* Origin Block */}
  {envMetrics.loginCountries?.length > 0 && (
    <DetailRow 
      label="Top Países" 
      value={envMetrics.loginCountries.slice(0, 3).map(c => 
        `${getCountryFlag(c.country)} ${c.country} (${c.count})`
      ).join(' ')}
    />
  )}
</div>
```

---

## Detalhes Técnicos

### Interface de Métricas

```typescript
interface EnvironmentMetrics {
  authType: 'cloud_only' | 'hybrid' | 'federated';
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  guestUsers: number;
  mfaEnabledPercent: number;
  conditionalAccessEnabled: boolean;
  conditionalAccessPoliciesCount: number;
  securityDefaultsEnabled: boolean;
  enterpriseAppsCount: number;
  appRegistrationsCount: number;
  storageUsedGB: number;
  storageTotalGB: number;
  loginCountries: Array<{ country: string; count: number }>;
}
```

### Função para Bandeira de País

```tsx
function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    'BR': '🇧🇷', 'US': '🇺🇸', 'PT': '🇵🇹', 'GB': '🇬🇧',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹',
    // ... mais países
  };
  return flags[countryCode] || '🌍';
}
```

### Atualizar DetailRow para suportar subValue

```tsx
function DetailRow({ 
  label, 
  value, 
  subValue,
  highlight, 
  indicator 
}: {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
  indicator?: "success" | "warning" | "error";
}) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-muted-foreground text-sm uppercase tracking-wide">{label}</span>
      <div className="text-right">
        <span className={cn("text-sm font-medium", highlight && "text-primary")}>
          {indicator && <span className={...}>{/* indicator dot */}</span>}
          {value}
        </span>
        {subValue && (
          <div className="text-xs text-muted-foreground">{subValue}</div>
        )}
      </div>
    </div>
  );
}
```

---

## Resultado Visual Esperado

O painel direito do Command Center mostrará informações estratégicas do ambiente M365:

1. Tipo de autenticação (Cloud/Hybrid/Federation)
2. Contagem de usuários (ativos, inativos, guests)
3. Contagem de aplicações (Enterprise + App Registrations)
4. Status de MFA (percentual)
5. Status de Conditional Access
6. Top países de origem de login (com bandeiras)

Isso substitui as métricas genéricas (Workspace, Data, Críticos, etc.) por dados reais do ambiente.

---

## Observações

- **Storage total**: Requer permissões de admin do SharePoint (Sites.Read.All). Pode não estar disponível em todos os tenants.
- **Países de login**: Depende de auditLogs/signIns que requer licença Azure AD P1/P2.
- **Fallback**: Se métricas não estiverem disponíveis, mostrar "N/A" ou ocultar a linha.

