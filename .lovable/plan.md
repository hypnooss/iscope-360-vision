

# Padronizar tamanho de todas as badges do AssetCard

## Problema

As badges da Row 1 (IP e ASN) usam o padding padrao do componente `Badge` (`px-2.5 py-0.5`), enquanto as badges da Row 2 (portas, servicos, certificado) usam `px-1.5` explicito e backgrounds coloridos. Isso faz as badges da Row 2 parecerem visualmente maiores/mais presentes.

## Alteracoes

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. Badge IP (linha 977)
Adicionar `px-1.5` ao className:
```
"font-mono text-muted-foreground border-border inline-flex items-center"
```
vira:
```
"font-mono text-muted-foreground border-border inline-flex items-center px-1.5"
```
(Remove a condicao de `text-sm` quando `hostname === ip`, mantendo sempre `text-[10px]` para consistencia com as demais badges.)

### 2. Badge ASN (linha 1012)
Adicionar `px-1.5`:
```
"text-[10px] text-muted-foreground border-border"
```
vira:
```
"text-[10px] px-1.5 text-muted-foreground border-border"
```

### 3. Badge "Sem Certificado" no CertStatusBadge (linha 591)
Adicionar `px-1.5` para consistencia:
```
"text-[10px] text-muted-foreground border-border"
```
vira:
```
"text-[10px] px-1.5 text-muted-foreground border-border"
```

Assim todas as badges informativas terao `text-[10px] px-1.5` como base de tamanho, ficando visualmente uniformes.

