
# Redistribuição das larguras de coluna — AssetCategorySection

## Problema

Em monitores largos (1920px), com o sidebar lateral (~260px), a área de conteúdo tem aproximadamente 1.640px disponíveis. As colunas fixas atuais somam apenas **810px** (140+180+200+80+110+100), deixando a coluna Nome com ~830px — quase metade da tela inteira. Resultado: tudo parece "espremido à direita".

## Solução

Aumentar as larguras fixas das colunas secundárias para que o total fixo suba para ~1.100px, deixando a coluna Nome com cerca de 500–550px em telas largas — um valor muito mais equilibrado.

---

## Novas larguras propostas

| Coluna     | Antes   | Depois    | Justificativa |
|------------|---------|-----------|---------------|
| Nome       | fluido  | fluido    | Cresce, mas não domina |
| Agent      | 140 px  | **180 px** | Mais espaço para nomes como `ESTRELA-SAO` |
| Workspace  | 180 px  | **240 px** | Nomes como `BRINQUEDOS ESTRELA` sem truncar |
| Frequência | 200 px  | **240 px** | Dois badges confortáveis (`Diário` + `20:00`) |
| Score      | 80 px   | **100 px** | Badge com padding generoso |
| Status     | 110 px  | **140 px** | Texto `Analisado` sem corte |
| Ações      | 100 px  | **120 px** | Botões com mais espaço |

**Total fixo:** 810px → **1.020px**

Em uma tela de 1.640px úteis, a coluna Nome ficará com ~620px — proporcional e legível.

---

## Mudança técnica

### `src/components/environment/AssetCategorySection.tsx`

Atualizar apenas o `<colgroup>` com os novos valores:

```tsx
<colgroup>
  <col />                                    {/* Nome — fluido */}
  <col style={{ width: '180px' }} />         {/* Agent */}
  <col style={{ width: '240px' }} />         {/* Workspace */}
  <col style={{ width: '240px' }} />         {/* Frequência */}
  <col style={{ width: '100px' }} />         {/* Score */}
  <col style={{ width: '140px' }} />         {/* Status */}
  <col style={{ width: '120px' }} />         {/* Ações */}
</colgroup>
```

Nenhuma outra mudança é necessária — o `table-fixed` e o `truncate` já estão funcionando corretamente.

---

## Arquivo modificado

- `src/components/environment/AssetCategorySection.tsx`
