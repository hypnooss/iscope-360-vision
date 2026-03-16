

## Plano: Alinhar menus do Header e Footer

### Problema
O Header tem apenas 2 links (Produto, Como Funciona), enquanto o Footer tem 4 links diferentes (Produto, Documentação, Segurança, Contato). Precisam estar consistentes.

### Solução

Unificar a navegação usando os mesmos 4 itens em ambos:

| Link | Destino (scroll) |
|---|---|
| Produto | `#features` |
| Documentação | `#blog` (seção Blog/Insights) |
| Segurança | `#problem` (seção Problem) |
| Contato | `#cta` (seção CTA final) |

**Header (`src/components/Header.tsx`):**
- Atualizar `NAV_LINKS` para os 4 itens acima

**Footer (`src/pages/Index.tsx`):**
- Converter os links estáticos do footer para usar scroll suave para as mesmas âncoras
- Adicionar os `id` necessários nas seções correspondentes (se ainda não existirem)

Ambos compartilharão a mesma estrutura de navegação, garantindo consistência visual conforme os prints de referência.

