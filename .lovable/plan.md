
# Corrigir Sync Parcial: Continuar Buscando CVEs Historicas

## Problema

Apos a sync inicial trazer 500 CVEs, o sistema seta `last_sync_at = NOW`. Na proxima execucao, a sync diferencial busca apenas CVEs modificadas apos esse timestamp, encontrando 0. As CVEs historicas restantes nunca sao importadas.

## Solucao: Paginacao Progressiva com Offset

Salvar o progresso da paginacao no campo `config` da fonte. Enquanto houver CVEs pendentes, o sistema continua de onde parou em vez de mudar para sync diferencial.

### Logica

```text
1. Sync full (last_sync_at = NULL):
   - Busca ate 500 CVEs a partir de startIndex = config.sync_offset || 0
   - Se buscou 500 (parcial): salva offset no config, NAO seta last_sync_at
   - Se buscou < 500 (completo): limpa offset, seta last_sync_at = NOW

2. Sync diferencial (last_sync_at != NULL):
   - Comportamento atual (busca por lastModStartDate) -- sem mudanca

3. Sync manual via botao "Sincronizar":
   - Se offset existe: continua sync full de onde parou
   - Se nao: faz sync diferencial normal
```

### Fluxo Visual

```text
  Clique "Sincronizar"
         |
   last_sync_at = NULL?
    /           \
  SIM            NAO
   |              |
  Full Sync     config.sync_offset > 0?
  offset=0       /          \
   |           SIM           NAO
   |            |             |
   |        Full Sync     Diferencial
   |        offset=N      (lastModDate)
   |            |             |
   Buscou 500?  Buscou 500?   Fim
   /    \       /    \
 SIM    NAO   SIM    NAO
  |      |     |      |
 Salva  Seta  Salva  Limpa offset
 offset sync  offset  Seta last_sync_at
       _at
```

## Alteracoes

### 1. Edge Function `refresh-cve-cache/index.ts`

**a) `fetchAllNvdPages`** -- Aceitar parametro `startIndex` inicial:

- Adicionar `startIndex?: number` nas options
- Iniciar paginacao a partir desse offset em vez de 0
- Retornar tambem o `totalResults` da API para saber se ha mais paginas

**b) `syncNistNvdSource` e `syncNistNvdWebSource`**:

- Ler `sync_offset` do `source.config`
- Se `last_sync_at` e NULL OU `sync_offset > 0`: fazer full sync a partir do offset
- Passar offset para `fetchAllNvdPages`
- Retornar flag indicando se a sync foi parcial e o novo offset

**c) Handler principal (apos sync)**:

- Se sync parcial: salvar `sync_offset` no config, NAO atualizar `last_sync_at`
- Se sync completa: limpar `sync_offset` do config, atualizar `last_sync_at = NOW`
- Manter status como `success` em ambos os casos, mas com mensagem diferente no `last_sync_error`

### 2. Sem alteracao no banco de dados

O campo `config` (JSONB) ja existe e pode armazenar `sync_offset` sem migracao.

### 3. Sem alteracao no frontend

O botao "Sincronizar" ja funciona corretamente. O usuario vera o contador de CVEs aumentando a cada clique ate completar a sync.

## Resultado Esperado

| Acao | Antes | Depois |
|---|---|---|
| 1o clique Sincronizar | 537 CVEs, sync "completa" | 500 CVEs, offset salvo |
| 2o clique Sincronizar | 0 novas (diferencial) | +500 CVEs (continua) |
| 3o clique Sincronizar | 0 novas | +restante, sync completa |
| Cliques seguintes | 0 novas | Diferencial normal |

## Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Adicionar logica de offset progressivo em 3 pontos |
