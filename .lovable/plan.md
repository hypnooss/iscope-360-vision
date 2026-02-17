

# Igualar estilo da badge IP ao da badge "Sem Certificado"

## Problema

A badge do IP tem estilo diferente da badge "Sem Certificado" (`CertStatusBadge`). Ela usa `bg-muted/30`, `border-border/50`, `gap-1`, `px-1.5`/`px-2 py-0.5` enquanto a badge de certificado usa apenas `text-[10px] text-muted-foreground border-border` com `mr-1` no icone.

## Alteracao

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linhas 976-982)

Trocar o estilo da badge IP de:

```text
font-mono bg-muted/30 text-muted-foreground border-border/50 gap-1 inline-flex items-center
text-sm px-2 py-0.5  (quando hostname === ip)
text-[10px] px-1.5   (quando hostname !== ip)
```

Para o mesmo padrao do `CertStatusBadge`:

```text
font-mono text-muted-foreground border-border
text-sm    (quando hostname === ip)
text-[10px] (quando hostname !== ip)
```

E trocar `className="w-3 h-3"` do icone `Network` para `className="w-3 h-3 mr-1"` (mesmo espacamento do icone `Lock` na badge de certificado).

Resultado: ambas as badges ficam visualmente identicas em estilo, diferindo apenas no conteudo (icone + texto).

