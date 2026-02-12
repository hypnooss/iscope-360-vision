
# Corrigir alinhamento da tabela de IPs

## Problema

O componente `Collapsible` do Radix UI renderiza uma `<div>` ao redor dos `<tr>` da tabela, quebrando a estrutura HTML da `<table>`. Isso causa o desalinhamento visivel entre os headers (IP, Origem, Portas, Servicos, CVEs, Referencia) e os dados nas linhas.

## Solucao

Remover o uso de `Collapsible`/`CollapsibleContent` e usar apenas `useState` para controlar a expansao de cada linha. Isso mantem a estrutura `<table> > <tbody> > <tr> > <td>` intacta.

## Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### Mudancas no componente `IPDetailRow`:

1. Remover `Collapsible`, `CollapsibleContent` e `CollapsibleTrigger` do componente
2. Manter o `useState` para `open` que ja existe
3. Renderizar diretamente um fragmento React (`<>`) contendo:
   - O `<TableRow>` principal (clicavel para toggle)
   - Condicionalmente (`{open && ...}`), um segundo `<tr>` com o conteudo expandido (o `<td colSpan={7}>` com detalhes)
4. Remover os imports de `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` do topo do arquivo (se nao forem usados em outro lugar)

### Resultado esperado:

A estrutura DOM ficara correta:
```text
<table>
  <thead><tr><th>IP</th><th>Origem</th>...</tr></thead>
  <tbody>
    <tr><td>3.133.227.151</td><td>DNS</td><td>0</td><td>0</td><td>0</td><td>briimage...</td><td>></td></tr>
    <!-- se expandido: -->
    <tr><td colspan="7">...detalhes...</td></tr>
  </tbody>
</table>
```

As colunas ficarao alinhadas corretamente com os headers.
