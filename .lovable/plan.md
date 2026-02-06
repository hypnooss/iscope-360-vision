

# Plano: Adicionar Informações Estratégicas do Ambiente M365

## Entendimento

O usuário quer ver **informações sobre o ambiente Microsoft 365** (não métricas da análise), como:
- Total de usuários
- Total de administradores
- Guests
- Licenças/Produtos
- etc.

## Dados Disponíveis

Os insights coletados já contêm métricas do ambiente nas descrições e `affectedCount`. Podemos extrair:

| Insight | Dado Extraível | Exemplo |
|---------|---------------|---------|
| IDT-001 | Total de usuários | "239 de **436** usuário(s)" |
| IDT-003 | Total de guests | "X guests no tenant" |
| IDT-006 | Contas desabilitadas | "72 conta(s) desabilitada(s)" |
| ADM-001 | Global Admins | "11 Global Admins" |
| ADM-003 | Usuários privilegiados | "13 usuário(s) com roles" |
| APP-xxx | Aplicações registradas | (pode ser extraído) |

## Solução

Criar uma função `extractEnvironmentMetrics` que parse as descrições dos insights para extrair métricas do ambiente, e exibi-las no painel direito do Command Center.

## Layout Proposto

```
┌─────────────────────────────────────────────┐
│ │ DOMÍNIO        aggroupbr.onmicrosoft.com   │
│ Tipo de autenticação (Cloud only / Hybrid via Azure AD Connect / Federation (ADFS)
│ ─────────────────────────────────────────── │
│ Nº total de usuários (ativos, inativos, convidados)│
│ Apps registradas (Enterprise Applications / App Registrations)
│ Storage total usado                 │
│ ─────────────────────────────────────────── │
│ MFA Status
│ Conditional Access Status
│ Origem Autenticação (bandeira dos países)
│ 
└─────────────────────────────────────────────┘
```

## Mudanças no Código

### Arquivo: `src/pages/m365/M365PostureReportPage.tsx`

**1. Adicionar função para extrair métricas do ambiente**

```tsx
// Extrair métricas do ambiente dos insights
const environmentMetrics = useMemo(() => {
  const metrics = {
    totalUsers: 0,
    totalAdmins: 0,
    totalGuests: 0,
    disabledAccounts: 0,
  };
  
  insights.forEach((insight: any) => {
    // IDT-001: "X de Y usuário(s) sem MFA" → Y = total de usuários
    if (insight.id === 'IDT-001') {
      const match = insight.descricaoExecutiva?.match(/de (\d+) usuário/);
      if (match) metrics.totalUsers = parseInt(match[1], 10);
    }
    
    // IDT-003 ou IDT-004: guests
    if (insight.id === 'IDT-003' || insight.id === 'IDT-004') {
      const count = insight.affectedCount || 0;
      if (count > metrics.totalGuests) metrics.totalGuests = count;
    }
    
    // IDT-006: contas desabilitadas
    if (insight.id === 'IDT-006') {
      metrics.disabledAccounts = insight.affectedCount || 0;
    }
    
    // ADM-003: usuários privilegiados
    if (insight.id === 'ADM-003') {
      metrics.totalAdmins = insight.affectedCount || 0;
    }
  });
  
  return metrics;
}, [insights]);
```

**2. Atualizar painel direito com métricas do ambiente**

```tsx
{/* Right Panel: Environment + Severity */}
<div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
  {/* Identification */}
  <DetailRow label="Workspace" value={displayInfo.client_name || 'N/A'} />
  <DetailRow label="Domínio" value={displayInfo.tenant_domain || 'N/A'} highlight />
  <DetailRow label="Data" value={format(...)} />
  
  <div className="h-px ... my-3" />
  
  {/* Environment Metrics */}
  <DetailRow 
    label="Usuários" 
    value={environmentMetrics.totalUsers > 0 ? environmentMetrics.totalUsers : 'N/A'} 
  />
  <DetailRow 
    label="Admins" 
    value={environmentMetrics.totalAdmins > 0 ? environmentMetrics.totalAdmins : 'N/A'} 
  />
  <DetailRow 
    label="Guests" 
    value={environmentMetrics.totalGuests > 0 ? environmentMetrics.totalGuests : 'N/A'} 
  />
  
  <div className="h-px ... my-3" />
  
  {/* Severity Breakdown (mantém) */}
  <DetailRow label="Críticos" ... />
  <DetailRow label="Alta" ... />
  <DetailRow label="Média" ... />
  <DetailRow label="Baixa" ... />
</div>
```

**3. Aumentar espaçamento entre gauge e MiniStats**

Linha 335: Mudar `mt-6` para `mt-10`

```tsx
<div className="flex gap-3 mt-10">
```



## Benefícios

- Mostra métricas do ambiente M365 (não apenas da análise)
- Usa dados já coletados (sem chamadas adicionais à API)
- Segue o padrão Command Center
- Maior espaçamento entre gauge e cards conforme solicitado

