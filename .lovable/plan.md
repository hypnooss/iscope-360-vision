
# Plano: Ajustar Visualização de Evidências de Nameservers

## Problema

Atualmente, as evidências de Nameservers estão sendo exibidas como JSON bruto na tela, mostrando `resolved_ips` e `resolved_ip_count` para cada nameserver. Isso não é amigável para usuários leigos.

Além disso, o texto "Diversidade via IPs" aparece na análise efetuada e deve ser removido.

## Objetivo

1. Exibir apenas os nomes dos nameservers nas evidências (sem os IPs resolvidos)
2. Remover o texto "Diversidade via IPs" / "Redundância via IPs" da mensagem de análise

---

## Alterações Necessárias

### 1. Edge Function - Formatador de Evidências NS

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Modificar o formatador de evidências `ns_records` (linhas 2214-2262) para retornar apenas os nomes dos nameservers, sem os IPs:

```text
Antes (linhas 2253-2258):
if (hosts.length > 0) {
  evidence.push({ label: 'Nameservers encontrados', value: hosts.slice(0, 50).join(', '), type: 'text' });
}
if (totalUniqueIps > 0) {
  evidence.push({ label: 'Total de IPs únicos resolvidos', value: String(totalUniqueIps), type: 'text' });
}

Depois:
if (hosts.length > 0) {
  evidence.push({ label: 'Nameservers encontrados', value: hosts.slice(0, 50).join(', '), type: 'text' });
}
// Nota: IPs resolvidos são usados internamente para cálculo de diversidade,
// mas não são exibidos nas evidências pois a análise já indica isso.
```

### 2. Edge Function - Remover Texto "via IPs"

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Modificar as mensagens de details para DNS-003 e DNS-004 (linhas 2516-2530):

```text
Antes (linha 2517):
details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos. Redundância via IPs.`;

Depois:
details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos.`;

Antes (linha 2529):
details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos. Diversidade via IPs.`;

Depois:
details = `${nsCount} nameserver(s) resolvendo para ${totalUniqueIps} IP(s) únicos.`;
```

---

## Resultado Esperado

### Evidências Coletadas (Após Alteração)

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

### Análise Efetuada (Após Alteração)

```text
2 nameserver(s) resolvendo para 12 IP(s) únicos.
```

*(Sem o texto "Diversidade via IPs" no final)*

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Remover evidência de IPs e ajustar texto de details |

---

## Observações

- Os IPs resolvidos continuam sendo coletados pelo agent e usados internamente para o cálculo de diversidade/redundância
- A análise efetuada já informa ao usuário que existem X IPs únicos por trás dos nameservers
- Não é necessário mostrar os IPs individualmente nas evidências, pois isso só confunde o usuário leigo
- O frontend já tem lógica para exibir nameservers de forma limpa (linhas 329-364 do EvidenceDisplay.tsx)
