

# Ajuste visual do Asset Card: portas, servicos e certificado

## O que muda

### 1. Portas e Servicos como badges (Row 2)

Atualmente as quantidades de portas e servicos sao exibidas como `<span>` com texto puro. Vamos converter para `<Badge>` com estilo consistente com os demais badges do card.

- **Portas**: Badge com icone `Server` e cor laranja (mesmo padrao do bloco expandido)
- **Servicos**: Badge com icone `Globe` e cor azul

### 2. Mover CertStatusBadge para Row 2

O badge de status do certificado TLS sera movido da Row 3 (linha dos CVEs) para a Row 2, apos a contagem de servicos, separado pelo ponto (`•`) ja utilizado como separador visual.

### Layout resultante

```text
Row 1: [hostname]  [IP]                    [RISK LEVEL]
Row 2: [11 portas]  •  [16 servicos]  •  [Expira em 30d]  •  [Pure-FTPd] [OpenSSH/7.4] ...
Row 3: [2 CRITICAL] [9 HIGH] [14 MEDIUM] [1 LOW]
```

## Detalhes tecnicos

Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Row 2 (linhas 506-523)**: Substituir os `<span>` de portas e servicos por `<Badge variant="outline">` com classes de cor. Inserir `<CertStatusBadge>` apos servicos com separador `•`.

**Row 3 (linhas 526-533)**: Remover a chamada `<CertStatusBadge asset={asset} />` desta linha, deixando apenas os CVE badges.

Cores propostas para os badges:
- Portas: `bg-orange-500/10 text-orange-400 border-orange-500/30` (consistente com o icone de Server usado no bloco expandido)
- Servicos: `bg-blue-500/10 text-blue-400 border-blue-500/30`

