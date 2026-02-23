

# Fix: Config Changes Nao Capturadas no BAU-FW

## Diagnostico

O FortiGate BAU-FW (FGT40F, v7.4.9) retorna `"results": []` e `"total_lines": 0` para a query de config_changes. O blueprint atual usa:
```
/api/v2/log/memory/event/system?filter=logid==0100044546||logid==0100044547&rows=500
```

O problema nao esta no `filterLogsByTime` (que foi implementado corretamente) -- o FortiGate simplesmente nao retorna nenhum log com esse filtro. Isso pode acontecer porque:
- O operador `||` (OR) no filtro de logs em memoria pode nao funcionar corretamente em todas as versoes do FortiOS
- O path `event/system` com subcategoria fixa pode nao incluir logs de config neste modelo

O GCP-FW funciona, mas o BAU-FW nao, apesar de ambos serem FortiGate.

## Solucao

Alterar o blueprint do FortiGate Analyzer para usar um filtro mais compativel para config_changes. Em vez de filtrar por logids especificos com operador OR, usar o filtro `subtype==config` que e o subcategoria padrao para eventos de configuracao no FortiOS:

```
/api/v2/log/memory/event/system?filter=subtype==config&rows=500
```

Isso captura todos os eventos de configuracao (criacao, edicao, delecao de objetos) sem depender de logids especificos ou operadores compostos.

### Detalhes Tecnicos

**Alteracao no banco de dados** (migration SQL):
- UPDATE na tabela `device_blueprints` para alterar o step `config_changes` no blueprint ativo do FortiGate Analyzer (executor_type = 'hybrid')
- Trocar o path de `filter=logid==0100044546||logid==0100044547` para `filter=subtype==config`

**Nenhuma alteracao em codigo** -- a Edge Function `firewall-analyzer` ja possui a logica de filtragem (`filterLogsByTime`) e o filtro de ruido do sistema (excluindo IPsec, tunnel-stats, usuarios desconhecidos/IPs) que vai continuar funcionando normalmente com o filtro mais amplo.

### Impacto

- Compatibilidade melhorada com todas as versoes do FortiOS
- Eventos de configuracao serao capturados corretamente no BAU-FW e em qualquer outro FortiGate
- O filtro de ruido existente no backend continua a remover eventos automaticos do sistema
- O `filterLogsByTime` continua filtrando apenas logs da ultima hora

