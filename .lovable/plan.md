
# Fix: Verificacao final do masscan no status de instalacao

## Problema

O masscan compilou e foi instalado corretamente em `/usr/local/bin/masscan`, porem a mensagem final diz "nao encontrado" porque `command -v masscan` nao encontra binarios em `/usr/local/bin/` quando esse diretorio nao esta no PATH do shell root naquele contexto.

O httpx ja tem essa verificacao dupla (linha 826), mas o masscan nao (linha 824).

## Correcao

Arquivo: `supabase/functions/super-agent-install/index.ts`, linha 824.

De:
```bash
command -v masscan >/dev/null 2>&1 && echo "  masscan: $(masscan --version ...)" || echo "  masscan: nao encontrado"
```

Para:
```bash
(command -v masscan >/dev/null 2>&1 || [[ -x /usr/local/bin/masscan ]]) && echo "  masscan: $(/usr/local/bin/masscan --version ...)" || echo "  masscan: nao encontrado"
```

Mesma abordagem ja usada para o httpx. Alteracao de uma unica linha.
