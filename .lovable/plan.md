

# Plano: Alinhar Formato de Relatório do Agent com Formato Original

## Contexto do Problema

O relatório gerado pelo novo fluxo (Python Agent + compliance_rules) está estruturalmente diferente do formato original (fortigate-compliance edge function direta):

1. **O formato original** gera ~35 checks detalhados com `description`, `recommendation`, `evidence`, organizados em categorias como array com `icon` e `passRate`

2. **O formato novo** gera apenas 8 checks básicos (das 8 regras cadastradas em `compliance_rules`), sem campos importantes e com estrutura de categorias como objeto

## Diferenças Técnicas

| Aspecto | Formato Original | Formato Agent | Impacto |
|---------|-----------------|---------------|---------|
| Nº de Checks | ~35 | 8 | Dashboard muito vazio |
| `categories` | Array | Object | UI quebra (já corrigido parcialmente) |
| Status | `warning` | `warn` | Cores erradas (já corrigido) |
| `description` | Presente | Ausente | Falta contexto |
| `recommendation` | Presente | Ausente | Falta orientação |
| `firmwareVersion` | Campo direto | Dentro de `system_info` | CVE Section não funciona |

## Opções de Solução

### Opção A: Enriquecer compliance_rules (Recomendado)
Adicionar mais campos às regras no banco e processar no agent-task-result:
- Adicionar `description`, `recommendation` ao output
- Cadastrar TODAS as ~35 regras de compliance (não apenas 8)
- Manter processamento centralizado no backend

**Prós**: Mantém arquitetura nova, regras configuráveis
**Contras**: Requer cadastrar muitas regras manualmente

### Opção B: Híbrido - Agent coleta + Backend processa com lógica completa
Após o agent retornar os dados brutos, o backend executa a mesma lógica complexa do fortigate-compliance original.

**Prós**: Resultado idêntico ao original
**Contras**: Duplica lógica complexa no backend

### Opção C: Transformação no Frontend (Paliativo)
Fazer o `FirewallAnalysis.tsx` transformar o formato novo no antigo, adicionando campos faltantes com valores default.

**Prós**: Rápido de implementar
**Contras**: Não resolve a falta de dados (description, recommendation)

## Solução Proposta: Opção A + C Combinadas

### Fase 1: Correção Imediata (Frontend)
Ajustar `FirewallAnalysis.tsx` para:
- Normalizar `score` → `overallScore`
- Extrair `firmwareVersion` de `system_info.version`
- Garantir que categorias sejam convertidas corretamente
- Adicionar `description` default = `details` quando ausente

### Fase 2: Enriquecimento das Regras (Backend)
1. Adicionar campos `recommendation` e `description` na tabela `compliance_rules`
2. Atualizar `agent-task-result` para incluir esses campos no output
3. Cadastrar regras adicionais para cobrir mais verificações

### Fase 3: Expandir Cobertura
Cadastrar as ~27 regras restantes para ter cobertura equivalente ao fluxo original.

## Arquivos a Modificar

### Fase 1 (Imediata)

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/FirewallAnalysis.tsx` | Melhorar transformação de dados do novo formato |

### Fase 2 (Backend)

| Item | Alteração |
|------|-----------|
| Tabela `compliance_rules` | Adicionar colunas `recommendation`, `pass_description`, `fail_description` |
| `agent-task-result/index.ts` | Incluir `description` e `recommendation` no output |

## Implementação Fase 1 (Prioridade)

A transformação em `fetchLastAnalysis` precisa:

```typescript
// Normalizar dados vindos do agent
const reportData: ComplianceReport = {
  overallScore: (rawData.overallScore as number) ?? (rawData.score as number) ?? 0,
  
  // Extrair firmware de system_info se não tiver direto
  firmwareVersion: (rawData.firmwareVersion as string) 
    ?? ((rawData.system_info as any)?.version as string)
    ?? undefined,
  
  // Para cada check, adicionar description = details se ausente
  // Normalizar status 'warn' -> 'warning'
};
```

## Resultado Esperado

Após implementação:
1. Dashboard exibe relatório sem erros
2. CVE Section funciona (tem firmwareVersion)
3. Checks mostram informações básicas
4. Estrutura preparada para expansão futura das regras

