

## Problema

O `handleStart` itera sobre `preview.dns` (todos os IPs de todos os domínios) em vez de respeitar o filtro. Além disso, ao carregar o preview, todos os IPs são pré-selecionados no `selectedDNS`, então IPs de domínios ocultos pelo filtro continuam selecionados e são enviados no scan.

## Correção

**Arquivo: `AttackSurfaceScanDialog.tsx`**

1. **`handleStart`** (linha 135): Trocar `preview.dns` por `filteredDNS` — só envia IPs visíveis no filtro atual
2. **Contagem `totalIPs`**: Usar `filteredDNS` em vez de `selectedDNS.size` para que o contador reflita apenas IPs do domínio filtrado

Isso garante que quando o usuário filtra por domínio e clica "Iniciar Scan", apenas os IPs visíveis e selecionados são enviados.

