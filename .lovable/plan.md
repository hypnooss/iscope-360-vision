

# Corrigir exibicao da ASN badge + bandeira + estilo do IP badge

## Problemas identificados

1. **ASN badge nao mostra o provider**: A condicao `asset.asn.provider !== 'unknown'` esconde o nome quando o provider e "unknown". Mas o campo `org` contem o nome da organizacao (ex: "CLOUDFLARENET", "MICROSOFT-CORP"). Precisamos exibir o `org` como fallback.
2. **Bandeira do pais nao aparece**: O campo `country` vem do RDAP (novo). Snapshots antigos nao tem esse dado. Para snapshots novos vai funcionar, mas precisamos verificar se o dado esta chegando.
3. **Estilo do IP badge**: Deve seguir o mesmo padrao visual dos badges da Row 2 (como `[Lock] Certificado Valido`), ou seja, com icone inline + texto.

## Alteracoes

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. IP badge com icone (estilo cert badge)

Trocar o badge simples do IP por um badge com icone `Globe` ou `Network` inline, seguindo o mesmo padrao do `CertStatusBadge`:

```text
[Network icon] 104.26.8.239
```

Usar classe similar: `text-[10px] px-1.5 bg-muted/30 text-muted-foreground border-border/50 font-mono`

### 2. ASN badge mostra org quando provider e unknown

Alterar a logica para exibir `org` como fallback do `provider`:

```text
Antes:  AS13335 (apenas se provider !== 'unknown')
Depois: AS13335 (cloudflare.com)  -- usa org se provider for 'unknown'
```

A logica fica: mostrar `provider` se nao for 'unknown', senao mostrar `org` (truncado se muito longo).

### 3. Bandeira do pais

Manter o codigo atual que renderiza a bandeira via `flag-icons`. Se o campo `country` nao existir no snapshot, a bandeira simplesmente nao aparece (retrocompativel). Novos scans com RDAP trarao o campo.

