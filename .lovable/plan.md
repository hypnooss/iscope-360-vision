
# Plano: Adicionar Resolução de IPs para Cálculo de Diversidade de Nameservers

## Contexto

Atualmente, a regra **DNS-004 (Diversidade de Nameservers)** apenas conta a quantidade de hostnames NS retornados, sem considerar quantos IPs existem por trás de cada nameserver.

A regra **MX-002 (Redundância MX)** já implementa essa lógica: quando há apenas 1 MX, o sistema verifica quantos IPs (A/AAAA) estão por trás do hostname e considera isso como redundância.

## Objetivo

Aplicar a mesma lógica de resolução de IPs que já existe para MX ao cálculo de diversidade de Nameservers (DNS-003 e DNS-004).

---

## Alterações Necessárias

### 1. Modificar o Python Agent - DNS Query Executor

**Arquivo:** `python-agent/agent/executors/dns_query.py`

Atualizar a consulta NS para resolver IPs A/AAAA de cada nameserver (similar ao que já é feito para MX):

```text
Antes (linha 50-57):
if query_type == 'NS':
    answers = resolver.resolve(domain, 'NS')
    records = [{'host': str(r.target).rstrip('.')} for r in answers]
    return {...}

Depois:
if query_type == 'NS':
    answers = resolver.resolve(domain, 'NS')
    records = []
    for r in answers:
        host = str(r.target).rstrip('.')
        # Resolver IPs A/AAAA do nameserver
        resolved_ips = []
        try:
            for rrtype in ['A', 'AAAA']:
                try:
                    ip_answers = resolver.resolve(host, rrtype)
                    for ip in ip_answers:
                        resolved_ips.append(str(ip))
                except Exception:
                    pass
            resolved_ips = sorted(list(set(resolved_ips)))
        except Exception:
            resolved_ips = []
        
        records.append({
            'host': host,
            'resolved_ips': resolved_ips,
            'resolved_ip_count': len(resolved_ips),
        })
    return {...}
```

### 2. Modificar a Edge Function - Avaliação de Regras

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Adicionar lógica especial para DNS-003 e DNS-004, similar à que existe para MX-002/MX-003 (linhas 2431-2464):

```text
Adicionar após a lógica de MX (linha ~2464):

// =====================================================
// External Domain - NS IP resolution handling
// Para diversidade de nameservers, considerar não apenas
// a quantidade de hostnames, mas também a quantidade
// total de IPs únicos resolvidos.
// =====================================================
if (logic.source_key === 'ns_records' && (rule.code === 'DNS-003' || rule.code === 'DNS-004')) {
  const records = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  
  // Coletar todos os IPs únicos de todos os nameservers
  const allIps = new Set<string>();
  for (const ns of records) {
    const ips = ns.resolved_ips;
    if (Array.isArray(ips)) {
      for (const ip of ips) {
        if (typeof ip === 'string') allIps.add(ip);
      }
    }
  }
  const totalUniqueIps = allIps.size;
  const nsCount = records.length;

  if (rule.code === 'DNS-003') {
    // Redundância de Nameservers (mínimo 2)
    // Passar se: 2+ NS hostnames OU 2+ IPs únicos atrás dos NS
    const hasMultipleNs = nsCount >= 2;
    const hasIpRedundancy = totalUniqueIps >= 2;
    status = (hasMultipleNs || hasIpRedundancy) ? 'pass' : 'fail';
    
    if (status === 'pass' && !hasMultipleNs && hasIpRedundancy) {
      details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos. Redundância via IPs.`;
    }
  }

  if (rule.code === 'DNS-004') {
    // Diversidade de Nameservers (mínimo 3)
    // Passar se: 3+ NS hostnames OU 3+ IPs únicos atrás dos NS
    const hasMultipleNs = nsCount >= 3;
    const hasIpDiversity = totalUniqueIps >= 3;
    status = (hasMultipleNs || hasIpDiversity) ? 'pass' : 'fail';
    
    if (status === 'pass' && !hasMultipleNs && hasIpDiversity) {
      details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos. Diversidade via IPs.`;
    }
  }
}
```

### 3. Atualizar Formatador de Evidências para NS

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Modificar a função que formata evidências de `ns_records` (linhas ~2214-2241) para incluir os IPs resolvidos:

```text
Atualizar formatação de evidências NS:

if (stepId === 'ns_records') {
  const d = (data && typeof data === 'object') ? (data as Record<string, unknown>) : undefined;
  const records = d?.records ?? d?.answers;
  
  const evidence: EvidenceItem[] = [];
  
  if (Array.isArray(records)) {
    const hosts: string[] = [];
    let totalIps = 0;
    
    for (const r of records) {
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        const host = o.host ?? o.name ?? o.value;
        if (typeof host === 'string') hosts.push(host);
        
        const ipCount = typeof o.resolved_ip_count === 'number' ? o.resolved_ip_count : 0;
        totalIps += ipCount;
      }
    }
    
    if (hosts.length > 0) {
      evidence.push({ label: 'Nameservers encontrados', value: hosts.join(', '), type: 'text' });
    }
    if (totalIps > 0) {
      evidence.push({ label: 'Total de IPs resolvidos', value: String(totalIps), type: 'text' });
    }
  }
  
  return evidence.length > 0 ? evidence : [{ label: 'Nameservers', value: 'Nenhum NS retornado', type: 'text' }];
}
```

---

## Resumo Visual do Fluxo

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        ANTES (Atual)                                │
├─────────────────────────────────────────────────────────────────────┤
│  Agent coleta NS:                                                   │
│    ns1.example.com                                                  │
│    ns2.example.com                                                  │
│                                                                     │
│  Edge Function avalia:                                              │
│    DNS-004: records.length >= 3 ?                                   │
│    Resultado: FAIL (apenas 2 nameservers)                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DEPOIS (Proposto)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Agent coleta NS + resolve IPs:                                     │
│    ns1.example.com → [1.1.1.1, 1.1.1.2]                             │
│    ns2.example.com → [2.2.2.1, 2.2.2.2]                             │
│                                                                     │
│  Edge Function avalia:                                              │
│    DNS-004: records.length >= 3 OU totalUniqueIps >= 3 ?            │
│    Resultado: PASS (4 IPs únicos = diversidade via IPs)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/executors/dns_query.py` | Adicionar resolução A/AAAA para cada NS |
| `supabase/functions/agent-task-result/index.ts` | Adicionar lógica especial para DNS-003/004 + atualizar evidências NS |

---

## Considerações

- A resolução de IPs no agent pode aumentar ligeiramente o tempo de coleta de dados (1-2 segundos adicionais por consulta NS)
- A lógica é conservadora: se houver 3+ nameservers hostnames OU 3+ IPs únicos, a verificação passa
- As evidências coletadas exibirão tanto os hostnames quanto a contagem total de IPs
