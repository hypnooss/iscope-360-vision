
# Colunas com largura fixa — AssetCategorySection

## Problema

Cada seção (Domínios Externos, Firewalls, Tenants M365) renderiza uma `<Table>` HTML independente. O browser calcula a largura de cada coluna com base no conteúdo daquela tabela específica, causando desalinhamento visual entre as seções.

## Solução

Usar `<colgroup>` + `<col>` com `table-layout: fixed` para definir larguras fixas em pixels para todas as colunas exceto "Nome", que recebe `width: auto` e se expande para preencher o espaço restante.

Com `table-layout: fixed`, o browser respeita as larguras declaradas e distribui o espaço restante apenas para a coluna sem largura definida (Nome).

---

## Mudanças técnicas

### `src/components/environment/AssetCategorySection.tsx`

**a) Adicionar `className="table-fixed w-full"` na `<Table>`:**

A classe `table-fixed` ativa o algoritmo `table-layout: fixed` do CSS, que é necessário para que o `<colgroup>` funcione corretamente.

**b) Adicionar `<colgroup>` logo após `<Table>` com as larguras:**

```tsx
<Table className="table-fixed w-full">
  <colgroup>
    <col />                          {/* Nome — fluido */}
    <col style={{ width: '140px' }} /> {/* Agent */}
    <col style={{ width: '180px' }} /> {/* Workspace */}
    <col style={{ width: '200px' }} /> {/* Frequência (dois badges) */}
    <col style={{ width: '80px' }} />  {/* Score */}
    <col style={{ width: '110px' }} /> {/* Status */}
    <col style={{ width: '100px' }} /> {/* Ações */}
  </colgroup>
  <TableHeader>
    ...
  </TableHeader>
```

**c) Adicionar `truncate` nas células de texto longo** para evitar overflow no "Nome" e "Workspace":

```tsx
<TableCell className="font-medium text-foreground max-w-0 truncate">{asset.name}</TableCell>
<TableCell className="text-muted-foreground truncate">{asset.workspaceName}</TableCell>
```

O `max-w-0` na coluna Nome junto com `truncate` garante que textos muito longos não forcem a coluna a crescer além do espaço disponível.

---

## Larguras propostas

| Coluna     | Largura   | Justificativa |
|------------|-----------|---------------|
| Nome       | fluido    | Cresce com a tela |
| Agent      | 140 px    | Nomes curtos como `ESTRELA-SAO` |
| Workspace  | 180 px    | Nomes médios como `BRINQUEDOS ESTRELA` |
| Frequência | 200 px    | Acomoda dois badges (`Diário` + `20:00`) |
| Score      | 80 px     | Badge pequeno (`89%`) |
| Status     | 110 px    | Badge médio (`Analisado`) |
| Ações      | 100 px    | Ícones ou botão "Abrir" |

---

## Arquivo modificado

- `src/components/environment/AssetCategorySection.tsx`
