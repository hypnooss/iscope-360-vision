

## Problema Identificado

O agendador (`run-scheduled-analyses`) só dispara `exchange-dashboard` após cada análise M365 (linhas 436-455). Ele **não dispara** `entra-id-dashboard` nem `collaboration-dashboard`.

IE Madeira e Precisio têm snapshots de `entra_id` porque alguém clicou manualmente em "Executar Análise" no frontend — que chama os 4 serviços via `Promise.all`. Os demais tenants só foram analisados pelo agendador, que ignora Entra ID e Colaboração.

Adicionalmente, o import do `@supabase/supabase-js` na Edge Function `entra-id-dashboard` está **sem versão pinada** (`@2` vs `@2.49.1`), o que pode causar falhas intermitentes em cold starts.

### Solução

**1. Adicionar chamadas a `entra-id-dashboard` e `collaboration-dashboard` no agendador**

No `supabase/functions/run-scheduled-analyses/index.ts`, após o bloco que chama `exchange-dashboard` (linha 455), adicionar blocos equivalentes para `entra-id-dashboard` e `collaboration-dashboard`, com a mesma lógica de retry.

**2. Pinar o import do supabase-js no `entra-id-dashboard`**

Alterar `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` para `'https://esm.sh/@supabase/supabase-js@2.49.1'` — alinhando com o padrão do `exchange-dashboard`.

### Arquivos alterados
- `supabase/functions/run-scheduled-analyses/index.ts` — adicionar chamadas Entra ID + Colaboração
- `supabase/functions/entra-id-dashboard/index.ts` — pinar versão do import

