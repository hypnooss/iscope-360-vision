

## Plano: Filtro por Domínio no Dialog do Surface Analyzer

### Problema
Quando o workspace tem mais de um domínio, todos os IPs DNS aparecem misturados sem indicação de qual domínio cada IP pertence. O usuário precisa filtrar por domínio para selecionar alvos específicos.

### Solução

**1. Edge Function `attack-surface-preview` — incluir info de domínio**

Cada `DNSTarget` passa a incluir `domain_id` e `domain_name`. A resposta também retorna uma lista de domínios encontrados:

```json
{
  "domains": [
    { "id": "uuid-1", "name": "mstech.com.br" },
    { "id": "uuid-2", "name": "outrodominio.com" }
  ],
  "dns": [
    { "ip": "20.88.194.227", "label": "ajuda.mstech.com.br", "domain_id": "uuid-1", "domain_name": "mstech.com.br" },
    ...
  ],
  "firewall": [...]
}
```

**2. Frontend `AttackSurfaceScanDialog.tsx` — filtro de domínio**

- Novo estado `selectedDomainFilter`: `'all'` ou um `domain_id`
- Quando há mais de 1 domínio, exibir um `Select` dropdown acima da lista DNS com as opções: "Todos os domínios" + cada domínio
- A lista DNS é filtrada pelo domínio selecionado
- Os contadores (alvos selecionados, total IPs) refletem o filtro ativo
- Select All / Deselect All operam apenas sobre os alvos visíveis (filtrados)
- Ao trocar o filtro, a seleção é preservada (não reseta)

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/attack-surface-preview/index.ts` | Adicionar `domain_id` e `domain_name` ao `DNSTarget`, retornar lista `domains` |
| `src/components/external-domain/AttackSurfaceScanDialog.tsx` | Adicionar dropdown de filtro por domínio, filtrar lista DNS |

### UI
O dropdown aparece entre o alert de aviso e a barra de "X de Y alvos selecionados", somente quando `domains.length > 1`. Estilo: `Select` do shadcn com ícone Globe.

