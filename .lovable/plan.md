
# Cancelar Syncs, Resincronizar Todas as Fontes e Exibir CVEs nos Agendamentos

## 1. Resetar sincronizacoes travadas (SQL)

Executar UPDATE para resetar as 2 fontes presas em "syncing" (History e PHP):

```text
UPDATE cve_sources 
SET last_sync_status = 'error', 
    last_sync_error = 'Cancelado manualmente pelo administrador'
WHERE last_sync_status = 'syncing';
```

## 2. Disparar sincronizacao de todas as fontes

Invocar a Edge Function `refresh-cve-cache` para cada fonte individualmente, iterando pelos 12 `source_id`s. Como a funcao agora processa 1 fonte por vez com limite de 500 CVEs, cada chamada sera rapida e segura.

## 3. Adicionar secao de CVE Sources na pagina de Agendamentos

### Arquivo: `src/pages/admin/SchedulesPage.tsx`

Adicionar uma nova secao no final da pagina (antes da tabela de agendamentos ou como uma tab/secao separada) que exibe o status das fontes de CVE:

- Buscar dados da tabela `cve_sources` via query
- Exibir uma tabela/lista compacta com:
  - Nome da fonte (`source_label`)
  - Modulo (badge colorido: Firewall/M365/Dominio Externo)
  - Status do ultimo sync (icone + label)
  - Data do ultimo sync (tempo relativo)
  - Quantidade de CVEs no cache
  - Indicador de sync parcial (quando `last_sync_error` contem "parcial")
- A secao tera titulo "Sincronizacao de CVEs" com icone Database
- Manter o mesmo estilo visual da pagina (badges, cores por modulo)

### Estrutura visual

```text
+--------------------------------------------------+
| Agendamentos                                      |
|                                                    |
| [Cards de stats existentes]                        |
| [Filtros existentes]                               |
| [Tabela de agendamentos existente]                |
|                                                    |
| ── Sincronizacao de CVEs ──────────────────────── |
|                                                    |
| Fonte          | Modulo   | Status   | Sync    | CVEs |
| FortiGate      | Firewall | Erro     | 1h atras| 0    |
| SonicWall      | Firewall | OK       | 12h     | 0    |
| Nginx          | Dom.Ext  | OK       | 30min   | 267  |
| Node.js        | Dom.Ext  | OK       | 30min   | 518  |
| ...            |          |          |         |      |
+--------------------------------------------------+
```

### Hook reutilizado

Importar `useCVESources` de `@/hooks/useCVECache` (ja existente) para buscar os dados, evitando duplicacao.

### Componentes reutilizados

- Badges de modulo com mesmas cores do `CVESourcesPage` (laranja/azul/esmeralda)
- Icones de status (CheckCircle2, XCircle, RefreshCw, Clock)
- `formatDistanceToNow` com locale ptBR

## Resumo

| Acao | Tipo |
|------|------|
| Reset fontes "syncing" | SQL (insert tool) |
| Disparar sync de todas as fontes | Chamada a Edge Function |
| Adicionar secao CVE Sources no SchedulesPage | Codigo (SchedulesPage.tsx) |
