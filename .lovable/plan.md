

# Ajuste: Recuo do conteudo expandido do card de ativo

## Alteracao

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linha 543)

Aumentar o padding esquerdo do container expandido. Atualmente usa `p-4` (16px uniforme). Trocar para `pl-10` (~40px a esquerda) mantendo o restante com `pr-4 py-4`, criando o recuo visual desejado sem bordas adicionais.

**De:**
```
<div className="border-t border-border/50 p-4 space-y-5 bg-muted/10">
```

**Para:**
```
<div className="border-t border-border/50 py-4 pr-4 pl-10 space-y-5 bg-muted/10">
```

