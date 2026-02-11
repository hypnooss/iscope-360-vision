
# Ajustes de Espacamento e Titulo nos Cards do Dashboard

## Alteracoes no arquivo `src/pages/GeneralDashboardPage.tsx`

1. **Aumentar gap horizontal entre colunas CVEs e Conformidade**: Trocar `gap-10` por `gap-14`

2. **Aumentar espacamento vertical entre gauge/colunas e texto "Ultima analise"**: Aumentar o `py-2` do container do gauge para `py-4`, e adicionar `mt-2` ao texto da ultima analise

3. **Mostrar titulo "Conformidade" no card Dominio Externo**: Alterar a logica do titulo da coluna -- em vez de `title={hasCves ? 'Conformidade' : ''}`, usar sempre `title="Conformidade"`

## Resumo das mudancas

| Local | De | Para |
|---|---|---|
| Linha 144, gap das colunas | `gap-10` | `gap-14` |
| Linha 133, padding vertical do container | `py-2` | `py-4` |
| Linha 149, titulo da coluna conformidade | `hasCves ? 'Conformidade' : ''` | `'Conformidade'` |
| Linha 158, texto ultima analise | sem margin top | adicionar `mt-2` |
