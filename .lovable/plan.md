

# Redesign: Tabela de Inventario de IPs Publicos - Simplificacao e CVE Summary

## Contexto

As tabelas acima (TechStackSection, WebServicesSection, TLSCertificatesSection) ja exibem servicos, tecnologias e certificados. Repetir essas informacoes na tabela de IPs e redundante. O objetivo e simplificar a tabela principal e melhorar a coluna de CVEs.

## Mudancas

### 1. Tabela principal - Remover coluna "Servicos"

Remover a coluna "Servicos" do header e do IPDetailRow, ja que essas informacoes ja sao exibidas nas secoes acima. Tambem ajustar o `colSpan` do painel expandido.

### 2. Coluna CVEs - Sumarizacao por criticidade

Substituir o badge unico com contagem total por badges coloridos por severidade:

```
1 CRITICAL  2 HIGH  2 MEDIUM
```

Cada badge tera a cor correspondente (vermelho para critical, laranja para high, amarelo para medium, etc). Se nao houver CVEs, exibir "0" como antes.

### 3. Painel expandido - Remover secoes redundantes

Remover as secoes "Servicos Descobertos" e "Web Services" do painel expandido, mantendo apenas:
- OS e Hostnames (informacao unica ao IP)
- CVEs Vinculadas (a lista detalhada que o usuario gostou - print 1)

### 4. CVEs Vinculadas - Melhorias visuais

A lista de CVEs (que o usuario aprovou no print 1) sera mantida e aprimorada:
- Manter layout em lista com severity badge, CVE ID, score e titulo
- Adicionar indicador visual do produto afetado (ex: "php", "nginx") como badge discreto
- Manter links clicaveis para NVD

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### Header da tabela (linhas 1169-1178)
Remover `<TableHead>Servicos</TableHead>` e ajustar colSpan de 7 para 6.

#### IPDetailRow - Coluna Servicos (linhas 823-838)
Remover todo o bloco da celula de servicos. O `serviceDisplay` useMemo pode ser removido tambem.

#### IPDetailRow - Coluna CVEs (linhas 839-845)
Substituir badge unico por sumarizacao por severidade:

```typescript
<TableCell>
  {ipCVEs.length > 0 ? (() => {
    const counts: Record<string, number> = {};
    for (const cve of ipCVEs) {
      const sev = (cve.severity || 'medium').toLowerCase();
      counts[sev] = (counts[sev] || 0) + 1;
    }
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    return (
      <div className="flex flex-wrap gap-1">
        {order.filter(s => counts[s]).map(s => (
          <Badge key={s} className={severityColorMap[s]}>
            {counts[s]} {s.toUpperCase()}
          </Badge>
        ))}
      </div>
    );
  })() : (
    <span className="text-muted-foreground font-mono">0</span>
  )}
</TableCell>
```

#### Painel expandido (linhas 849-1007)
Remover secoes "Servicos Descobertos" (linhas 874-901) e "Web Services" (linhas 903-967). Manter apenas OS, Hostnames e CVEs Vinculadas.

#### CVE list - Adicionar badge de produto afetado
Na lista de CVEs, extrair o nome do produto dos `products` do CVE para exibir como contexto:

```typescript
<span className="text-xs text-muted-foreground truncate flex-1">
  {cve.title || 'vulnerability'}
</span>
```

### Resultado visual esperado

**Tabela principal (6 colunas)**:
| IP | Origem | Referencia | Portas | CVEs | |
|---|---|---|---|---|---|
| 187.85.164.49 | DNS | drive.taschibra.com.br | 80 443 | `1 CRITICAL` `2 HIGH` `2 MEDIUM` | > |

**Painel expandido**: Apenas OS/Hostnames + lista de CVEs detalhada (como no print 1).

