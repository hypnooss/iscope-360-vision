

# Exibir IP como badge + bandeira do pais na linha do asset

## O que muda

Na primeira linha do `AssetCard` (hostname + IP + ASN), atualmente o IP aparece como texto simples com tooltip. A alteracao transforma essa linha para exibir:

1. **Hostname** (texto, como esta hoje)
2. **IP em badge** - estilo similar ao badge de ASN, com fundo neutro/cinza e fonte mono
3. **ASN badge** (ja existe, mantem)
4. **Bandeira do pais** - usando `flag-icons` (ja instalado), exibida como um pequeno icone inline ao lado do IP ou ASN
5. **Risk badge** (ja existe, mantem no `ml-auto`)

O tooltip rico no IP continua funcionando - o badge do IP sera o trigger do tooltip.

Quando o hostname for igual ao IP, o badge do IP assume o papel de titulo (fonte um pouco maior).

## Detalhes tecnicos

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Alteracao na Row 1 do `AssetCard` (linhas 967-1007):

- Transformar o `<span>` do IP em um `<Badge>` com estilo neutro (ex: `bg-muted/50 text-muted-foreground border-border/50 font-mono`)
- Adicionar a bandeira do pais logo apos o badge de ASN: `<span className="fi fi-{country}" />` usando o campo `asset.asn?.country`
- Manter o `TooltipTrigger asChild` envolvendo o badge do IP com `<span className="inline-flex cursor-help">`
- Quando `hostname === ip`, exibir apenas o badge do IP (sem duplicar)

Exemplo visual da linha resultante:

```text
painelhcm.estrela.com.br  [186.201.152.82]  [AS10429]  [BR flag]  .... [Critical]
```
