

# Ajustes visuais nos Asset Cards

## 3 alteracoes no arquivo `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. Severidades em formato capitalizado e portugues

Na funcao `CVESummaryBadges` (linha 443), trocar `s.toUpperCase()` por labels em portugues com inicial maiuscula.

Mapeamento:
- critical -> "Critical" (manter ingles pois e termo tecnico de CVE) ou capitalizar: `s.charAt(0).toUpperCase() + s.slice(1)`

Resultado: `2 Critical` em vez de `2 CRITICAL`, `9 High` em vez de `9 HIGH`, etc.

### 2. Prefixo "Certificado" no CertStatusBadge

Na funcao `CertStatusBadge` (linhas 451-477), adicionar a palavra "Certificado" antes de cada label:

- Linha 452: "Sem TLS" -> badge com "Sem Certificado" (ver item 3)
- Linha 459: "Expirado ha Xd" -> "Certificado Expirado ha Xd"
- Linha 469: "Expira em Xd" -> "Certificado Expira em Xd"
- Linha 475: "Valido" -> "Certificado Valido"

### 3. Converter textos planos em badges

**"Sem TLS" (linha 452)**: Trocar o `<span>` por um `<Badge variant="outline">` com estilo neutro (muted), incluindo icone de cadeado.

```tsx
// De:
<span className="text-xs text-muted-foreground">Sem TLS</span>
// Para:
<Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
  <Lock className="w-3 h-3 mr-1" /> Sem Certificado
</Badge>
```

**"0 CVEs" (linha 535)**: Trocar o `<span>` por um `<Badge variant="outline">` com estilo neutro.

```tsx
// De:
<span className="text-xs text-muted-foreground">0 CVEs</span>
// Para:
<Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground border-border">
  0 CVEs
</Badge>
```

## Resultado visual esperado

```
Row 2: [11 portas] . [16 servicos] . [Certificado Expira em 30d] . [nginx] ...
Row 3: [2 Critical] . [9 High] . [14 Medium] . [1 Low]

Sem certificado:
Row 2: [0 portas] . [0 servicos] . [Sem Certificado] . [HSTS]
Row 3: [0 CVEs]
```

