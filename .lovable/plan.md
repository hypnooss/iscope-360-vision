

# Correcao: period_start dinamico baseado no ultimo snapshot

## Problema

O trigger `trigger-firewall-analyzer` sempre define `period_start = now - 1 hora`, independentemente de quando o ultimo snapshot foi concluido. Isso causa:

1. **Overlap com snapshots anteriores**: dados ja processados sao recoletados
2. **Volume excessivo de logs**: janela larga demais faz steps como auth_events, vpn_events e config_changes atingirem o limite de 10.000 registros (max_pages=20), que sao truncados para 1.500 -- perda de ~85% dos dados
3. **Ineficiencia**: reprocessa periodo ja coberto pelo snapshot anterior

### Exemplo concreto (log do usuario)

| Item | Valor |
|---|---|
| Ultimo snapshot period_end | 17:00 BRT (20:00 UTC) |
| Trigger manual | 17:33 BRT (20:33 UTC) |
| period_start calculado | 16:33 BRT (19:33 UTC) -- **1h atras** |
| period_start ideal | 17:00 BRT (20:00 UTC) -- **ultimo period_end** |
| Janela real | 1h (16:33 a 17:33) |
| Janela ideal | 33min (17:00 a 17:33) |

## Solucao

Alterar o trigger `trigger-firewall-analyzer` para consultar o ultimo snapshot `completed` do firewall e usar seu `period_end` como `period_start` do novo snapshot. Manter o fallback de 1 hora caso nao exista snapshot anterior.

Mesma logica deve ser aplicada ao `trigger-firewall-analyzer` (o trigger do Analyzer, nao o de compliance).

## Alteracoes

### 1. `supabase/functions/trigger-firewall-analyzer/index.ts`

Antes de criar o snapshot, consultar o ultimo snapshot completo:

```text
// Buscar period_end do ultimo snapshot completado
const { data: lastSnapshot } = await supabase
  .from('analyzer_snapshots')
  .select('period_end')
  .eq('firewall_id', firewall_id)
  .eq('status', 'completed')
  .order('period_end', { ascending: false })
  .limit(1)
  .maybeSingle();

const now = new Date().toISOString();
// Usar period_end do ultimo snapshot, ou fallback 1h atras
const periodStart = lastSnapshot?.period_end
  ? lastSnapshot.period_end
  : new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
```

Isso substitui a linha fixa:
```text
// REMOVER:
const periodStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
```

### 2. Protecao contra janelas muito grandes

Se o ultimo snapshot for muito antigo (ex: dias atras), a janela pode ficar enorme. Adicionar um cap maximo de 2 horas:

```text
const maxWindowMs = 2 * 60 * 60 * 1000; // 2 horas max
const fallbackStart = new Date(Date.now() - maxWindowMs).toISOString();

let periodStart: string;
if (lastSnapshot?.period_end) {
  // Usar o mais recente entre: ultimo period_end e (now - 2h)
  const lastEnd = new Date(lastSnapshot.period_end).getTime();
  const minStart = Date.now() - maxWindowMs;
  periodStart = new Date(Math.max(lastEnd, minStart)).toISOString();
} else {
  periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
}
```

## Arquivo a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Consultar ultimo snapshot completed e usar seu period_end como period_start, com cap de 2h |

## Resultado esperado

| Cenario | Antes | Depois |
|---|---|---|
| Snapshot manual 33min apos anterior | Janela de 1h, 10k+ logs truncados | Janela de 33min, volume proporcional |
| Snapshot agendado (hourly) | Janela de 1h, overlap potencial | Janela exata desde ultimo period_end |
| Primeiro snapshot (sem anterior) | 1h atras | 1h atras (fallback mantido) |
| Ultimo snapshot > 2h atras | N/A | Cap de 2h para evitar janelas enormes |

