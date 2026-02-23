

# Filtrar Logs de Configuracao por Horario no Firewall Analyzer

## Problema

O blueprint do FortiGate coleta ate 500 registros de alteracoes de configuracao via API REST, sem filtro de tempo. Como o Analyzer roda de hora em hora, muitos desses 500 registros podem ser de periodos anteriores (ja processados), e alteracoes recentes podem nao aparecer porque o limite de 500 ja foi preenchido com logs antigos que ja foram persistidos.

O correto e: ao processar os logs no backend (Edge Function), filtrar apenas os logs cujo timestamp esteja dentro do periodo do snapshot (ultima 1 hora), garantindo que alteracoes recentes sejam capturadas e que logs antigos ja persistidos nao sejam reprocessados desnecessariamente.

## Solucao

Alterar a Edge Function `firewall-analyzer` para filtrar os logs de `config_changes` (e opcionalmente todos os outros tipos de log) pelo timestamp, usando o `period_start` do snapshot como referencia.

### Detalhes Tecnicos

**Arquivo: `supabase/functions/firewall-analyzer/index.ts`**

1. Na secao principal (apos extrair `configData` na linha ~1016), adicionar logica para buscar o `period_start` do snapshot e filtrar os logs de config_changes pelo campo de data/hora do log (`date` + `time`, ou `eventtime`).

2. Criar uma funcao auxiliar `filterLogsByTime(logs, periodStart)` que:
   - Recebe o array de logs e o timestamp de inicio do periodo
   - Para cada log, monta o timestamp a partir de `log.date` + `log.time` (formato FortiGate: `"2026-02-22"` + `"19:10:05"`) ou `log.eventtime` (epoch em segundos)
   - Filtra apenas os logs cujo timestamp >= `period_start`
   - Retorna o array filtrado

3. Aplicar esse filtro em `configData` antes de passar para `analyzeConfigChanges()`:
   ```
   const filteredConfigData = filterLogsByTime(configLogs, periodStart);
   ```

4. Tambem aplicar o filtro nos demais tipos de log (denied_traffic, auth_events, vpn_events, etc.) para consistencia, ja que todos sofrem da mesma limitacao de 500 registros.

5. O `period_start` sera obtido do snapshot que ja esta salvo no banco (criado pelo `trigger-firewall-analyzer` com `period_start = now - 1h`). Caso nao exista, usar fallback de 1 hora atras.

### Impacto

- Logs coletados fora do periodo de 1 hora serao descartados no processamento
- Alteracoes de configuracao feitas dentro da janela de 1 hora serao corretamente capturadas e persistidas na tabela `analyzer_config_changes`
- Nenhuma alteracao no blueprint ou no agente Python e necessaria
- Funciona tanto para execucoes agendadas quanto manuais

