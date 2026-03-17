

## Diagnóstico

A Edge Function `attack-surface-preview` funciona corretamente quando chamada diretamente (retorna 9 alvos DNS para OURO SAFRA). O erro **"Failed to send a request to the Edge Function"** é um `FunctionsFetchError` transiente causado por **cold start instável** — o import `https://esm.sh/@supabase/supabase-js@2` (sem versão fixa) pode falhar intermitentemente quando o CDN esm.sh redireciona para versões diferentes durante o boot.

Conforme a regra do projeto (memory: `standard-configuration`), imports devem ser pinados em versões específicas.

## Correção

### `supabase/functions/attack-surface-preview/index.ts`
Pinar o import na linha 1:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
```

### `supabase/functions/consolidate-attack-surface/index.ts`
Mesmo fix na linha 1.

### `supabase/functions/attack-surface-step-result/index.ts`
Mesmo fix na linha 1.

### `supabase/functions/attack-surface-rescan-ip/index.ts`
Mesmo fix na linha 1.

Depois, fazer deploy dessas 4 funções. As demais 44 funções com import flutuante podem ser corrigidas incrementalmente.

