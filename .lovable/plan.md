

# Adicionar Linha de Contexto (Portas, Servicos, Certificado, Tecnologias) nos Cards do AssetHealthGrid

## Problema

Na V1, cada card de ativo exibia uma segunda linha com badges informativos: quantidade de portas, quantidade de servicos, status do certificado TLS e tecnologias detectadas, separados por bullets. Na V3, essa linha nao existe nos cards do "Saude dos Ativos".

## Solucao

Adicionar uma linha intermediaria nos cards expandidos (com achados) e compactos (ok) do `AssetHealthGrid`, entre a linha de hostname/IP/ASN e a linha de severidades.

### Detalhes tecnicos

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

**1. Expandir a interface `AssetHealthGridProps` para receber os dados necessarios:**

Adicionar `ports`, `tlsCerts` (com `daysRemaining`), `expiredCerts`, `expiringSoonCerts` e `allTechs` ao tipo dos assets na prop.

**2. Expandir a interface `AssetHealth` para armazenar os novos dados:**

Adicionar `ports: number`, `expiredCerts: number`, `expiringSoonCerts: number`, `hasCerts: boolean`, `certStatus`, e `allTechs: string[]`.

**3. Adicionar funcao auxiliar `getTechBadgeColor`** (replicada da V1):

Mapeia tecnologias para cores: seguranca (teal), servidores (blue), linguagens (purple), frameworks (amber).

**4. Adicionar componente `CertStatusBadge`** (replicado da V1):

Exibe "Certificado Valido" (verde), "Certificado Expirado ha Xd" (vermelho), "Certificado Expira em Xd" (amarelo), ou "Sem Certificado" (cinza).

**5. Adicionar a linha de contexto nos cards:**

```
[N portas] . [N servicos] . [CertStatus] . [Tech1] [Tech2] [Tech3] [Tech4] [+N]
```

- Badges de portas: fundo laranja (como V1)
- Badges de servicos: fundo azul (como V1)
- Tecnologias limitadas a 4 visiveis + badge "+N" com tooltip mostrando todas
- Bullets (.) como separadores entre grupos

**6. A linha aparece em ambos os layouts** (ok e com achados), posicionada apos a linha de hostname/IP/ASN.

Nenhuma mudanca necessaria no `SurfaceAnalyzerV3Page.tsx` pois o array `assets` ja contem todos esses campos (`ports`, `tlsCerts`, `expiredCerts`, `expiringSoonCerts`, `allTechs`) do tipo `ExposedAsset`.
