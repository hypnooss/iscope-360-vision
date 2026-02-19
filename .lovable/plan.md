
# Correção: `calculateNextRunAt` não suporta `hourly`

## Causa Raiz

Na edge function `run-scheduled-analyses`, a função `calculateNextRunAt` só trata `daily` e `weekly`. Qualquer outro valor (incluindo `hourly`) cai no `else` que trata como `monthly`:

```ts
} else {
  // monthly  ← hourly cai aqui!
  next = new Date(Date.UTC(..., dayOfMonth, hour, 0, 0));
  if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
}
```

Como `dayOfMonth` por padrão é `1`, em 19/02 isso resulta em **01/03** — exatamente os "10 dias" vistos na tela.

## Correção

Adicionar o caso `hourly` antes do `else`, calculando a próxima hora cheia:

```ts
} else if (frequency === 'hourly') {
  // Próxima hora cheia (ex: agora são 14:23 → next = 15:00)
  next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
} else {
  // monthly
  ...
}
```

Após essa mudança, ao completar uma execução horária, o `next_run_at` será atualizado para a próxima hora cheia — e a coluna "Próxima Execução" mostrará algo como "em 45 minutos" em vez de "em 10 dias".

## Arquivo modificado

- `supabase/functions/run-scheduled-analyses/index.ts` — somente a função `calculateNextRunAt` (linhas 8–32)

A edge function precisará ser reimplantada após a alteração.
