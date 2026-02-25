

# Melhorias na Visibilidade do HUB de Licenciamento

## 1. Firewalls - Sumarizar servicos FortiGuard por data de vencimento

**Problema:** Cada servico aparece individualmente com seu badge, gerando muita poluicao visual quando todos vencem na mesma data (ex: 12 servicos todos com "28/07/2026 (154d)").

**Solucao em `src/pages/LicensingHubPage.tsx`:**

Agrupar servicos pela data de vencimento e exibir de forma compacta:

```text
Antes:
  IPS: 28/07/2026 (154d)  App Control: 28/07/2026 (154d)  Antivirus: 28/07/2026 (154d) ...

Depois:
  28/07/2026 (154d): IPS, App Control, Antivirus, Web Filter, Botnet Domain, Cloud Sandbox, ...
  14/02/2026 (expirado): FortiCloud
```

Implementacao:
- Criar funcao `groupServicesByExpiry(services)` que agrupa por `expiresAt`
- Renderizar cada grupo como: Badge de data + lista de nomes separados por virgula
- Servicos sem data agrupados separadamente como "Sem data"
- Manter cores do badge conforme status (verde/amarelo/vermelho)

---

## 2. M365 - Manter licencas separadas + ocultar expiradas > 60 dias

**Requisito:** Mesmo produto (ex: Power BI Pro) pode ter contratos distintos com datas e quantidades diferentes. Manter cada linha separada.

**Implementacao em `src/pages/LicensingHubPage.tsx`:**

- Filtrar do array `filteredM365` as licencas expiradas ha mais de 60 dias (`daysLeft < -60`)
- Exibir apenas as licencas validas ou recentemente expiradas na tabela principal
- Abaixo da tabela, mostrar um texto sutil: "X licenca(s) expirada(s) ha mais de 60 dias oculta(s)" em `text-muted-foreground` com opcao de expandir/mostrar

---

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | 1) Agrupar servicos FortiGuard por data na coluna de servicos; 2) Ocultar licencas M365 expiradas > 60 dias com indicador sutil |

