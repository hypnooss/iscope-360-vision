

# Padronizar tela Compliance com as outras telas de Dominio Externo

## Diferencas identificadas

Comparando a tela Compliance com Dominios Externos, Analyzer e Execucoes:

| Aspecto | Compliance (atual) | Padrao (referencia) |
|---|---|---|
| Card da tabela | Usa `CardHeader` com `CardTitle` e `CardDescription` | Usa apenas `Card > CardContent className="p-0"` sem header |
| Classe do card | `glass-card` | Dominios Externos usa `Card` sem glass-card; Execucoes usa `glass-card` |
| Filtros | Standalone com icone `Filter` separado | Dominios Externos: search bar standalone; Execucoes: filtros dentro de um Card |
| Estado vazio | Dentro do CardContent com texto | Padrao: dentro do CardContent com icone + texto centralizado |
| Loading | Loader dentro do CardContent | Padrao igual |

## Mudancas propostas

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**1. Remover CardHeader/CardTitle/CardDescription da tabela**

O card da tabela passara a usar apenas `Card > CardContent className="p-0"`, sem o header com titulo e descricao (seguindo o padrao de Dominios Externos).

**2. Mover os filtros para o padrao**

Os filtros de cliente e dominio serao mantidos como estao (standalone), pois a tela de Dominios Externos tambem usa filtros standalone. Apenas remover o icone `Filter` avulso para simplificar.

**3. Ajustar estrutura do Card da tabela**

```
De:
  <Card className="glass-card">
    <CardHeader>
      <CardTitle>...</CardTitle>
      <CardDescription>...</CardDescription>
    </CardHeader>
    <CardContent>
      <Table>...</Table>
    </CardContent>
  </Card>

Para:
  <Card>
    <CardContent className="p-0">
      <Table>...</Table>
    </CardContent>
  </Card>
```

**4. Remover imports nao utilizados**

Remover `CardDescription`, `CardHeader`, `CardTitle`, `FileText` e `Filter` dos imports apos as mudancas.

**5. Ajustar estado vazio**

O estado vazio ficara dentro do `CardContent` com `p-12 text-center` seguindo o padrao de Dominios Externos.

## Resumo

A tela Compliance tera a mesma estrutura visual das outras telas: header responsivo (ja ajustado), filtros standalone, e tabela em Card limpo sem header decorativo.

