

## Limpar Snapshots do Exchange Analyzer

Existem **541 snapshots** (512 completed + 29 failed) na tabela `m365_analyzer_snapshots`. Não há tabelas dependentes com foreign keys, então a exclusão é segura.

### Ação

Executar o seguinte DELETE na tabela `m365_analyzer_snapshots`:

```sql
DELETE FROM m365_analyzer_snapshots;
```

Isso removerá todos os snapshots com janelas sobrepostas. A próxima execução do Exchange Analyzer criará snapshots limpos usando as janelas consecutivas (`period_start` = `period_end` do último snapshot), eliminando a duplicação de dados.

