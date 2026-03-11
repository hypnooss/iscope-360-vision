

## Deletar todos os snapshots do Firewall Analyzer

**Ação**: Executar `DELETE FROM analyzer_snapshots` para remover todos os 21.234 registros.

**O que NÃO será afetado**:
- `analyzer_config_changes` — permanece intacta
- `analyzer_schedules` — permanece intacta
- Todas as outras tabelas

**Arquivo alterado**: Nenhum — apenas operação de dados via SQL.

