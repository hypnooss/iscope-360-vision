
# Plano: Corrigir Formatador de Evidências para DNS-003 e DNS-004

## Diagnóstico

O problema identificado está na Edge Function `agent-task-result`. As regras **DNS-003** e **DNS-004** não possuem um formatador de evidências específico como as outras regras de domínio externo (MX-001, MX-002, DKIM-001, etc.).

Por isso, elas caem no **fallback genérico** (linha 2897) que simplesmente serializa o `value` completo (incluindo `resolved_ips` e `resolved_ip_count`) como JSON.

## Problema no Código Atual

```typescript
// Linha 2897-2900: Fallback genérico
else if (value !== undefined && value !== null) {
  evidence = formatGenericEvidence(value, logic.field_path || rule.name);
}
```

Como DNS-003/DNS-004 não têm um `else if` específico, eles usam o fallback que mostra o JSON completo.

## Solução

Adicionar casos específicos para **DNS-003** e **DNS-004** que extraem apenas os nomes dos nameservers, similar ao que já existe para MX-001:

```typescript
// DNS-003: Redundância de Nameservers (só hostnames)
else if (rule.code === 'DNS-003') {
  const nsData = sourceData as Record<string, unknown>;
  const records = (nsData?.data as Record<string, unknown>)?.records as Array<Record<string, unknown>> || [];
  if (records.length > 0) {
    const hosts = records.map(r => String(r.host || r.name || r.value)).filter(Boolean);
    evidence = [{ 
      label: 'Nameservers encontrados', 
      value: hosts.join(', '), 
      type: 'text' 
    }];
  } else {
    evidence = [{ label: 'Nameservers', value: 'Nenhum NS encontrado', type: 'text' }];
  }
}
// DNS-004: Diversidade de Nameservers (só hostnames)
else if (rule.code === 'DNS-004') {
  const nsData = sourceData as Record<string, unknown>;
  const records = (nsData?.data as Record<string, unknown>)?.records as Array<Record<string, unknown>> || [];
  if (records.length > 0) {
    const hosts = records.map(r => String(r.host || r.name || r.value)).filter(Boolean);
    evidence = [{ 
      label: 'Nameservers encontrados', 
      value: hosts.join(', '), 
      type: 'text' 
    }];
  } else {
    evidence = [{ label: 'Nameservers', value: 'Nenhum NS encontrado', type: 'text' }];
  }
}
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Adicionar cases específicos para DNS-003 e DNS-004 (~linhas 2845-2847) |

---

## Resultado Esperado

Após a alteração, as evidências de DNS-003 e DNS-004 serão exibidas como:

```text
┌───────────────────────────────────────────────────┐
│  EVIDÊNCIAS COLETADAS                             │
│  ────────────────────                             │
│  Nameserver                                       │
│  earl.ns.cloudflare.com                           │
│                                                   │
│  Nameserver                                       │
│  leah.ns.cloudflare.com                           │
└───────────────────────────────────────────────────┘
```

Isso porque:
1. A Edge Function agora retornará `{ label: 'Nameservers encontrados', value: 'earl.ns.cloudflare.com, leah.ns.cloudflare.com', type: 'text' }`.
2. O frontend (`EvidenceDisplay.tsx`, linhas 486-493) já possui lógica para separar valores com vírgula e exibir cada um em um bloco individual.

---

## Observações

- A lógica de avaliação (pass/fail) para DNS-003/DNS-004 usando IPs resolvidos permanece inalterada (linhas 2492-2530).
- Apenas a **formatação das evidências** será ajustada para esconder os dados técnicos de IPs.
- Os IPs resolvidos continuam disponíveis no `rawData` para usuários com acesso técnico (super_admin/super_suporte).
