

# Ajuste de tamanho dos badges e separadores nos CVEs

## Problema

Os badges de portas, servicos e tecnologias usam `py-0` que os torna menores que o badge de certificado. Os CVE badges tambem usam `py-0`. O badge de certificado nao tem `py-0`, por isso e maior.

## Correcoes

### 1. Igualar tamanho dos badges (remover `py-0`)

Remover `py-0` dos seguintes badges para que fiquem do mesmo tamanho que o CertStatusBadge:

- Portas badge (linha 507): `px-1.5 py-0` -> `px-1.5`
- Servicos badge (linha 509): `px-1.5 py-0` -> `px-1.5`
- Tech badges (linha 517): `px-1.5 py-0` -> `px-1.5`
- Overflow tech badge (linha 520): `px-1.5 py-0` -> `px-1.5`
- CVE badges no CVESummaryBadges (linha 440): `px-1.5 py-0` -> `px-1.5`

### 2. Adicionar separador `•` entre CVE badges

No componente `CVESummaryBadges`, trocar o `gap-1` por `gap-2` e inserir `<span className="text-border">•</span>` entre cada badge de severidade.

### Resultado visual

```
Row 2: [11 portas]  •  [16 servicos]  •  [Expira em 30d]  •  [Pure-FTPd] ...
Row 3: [2 CRITICAL]  •  [9 HIGH]  •  [14 MEDIUM]  •  [1 LOW]
```

Todos os badges com o mesmo padding vertical, tamanho uniforme.

