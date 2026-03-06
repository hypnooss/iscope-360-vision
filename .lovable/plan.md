

## Consolidar insights com mesmo nome no backend do M365 Analyzer

### Problema

O backend gera um insight separado por usuário (ex: 4x "Envio Anômalo de Emails"), cada um com `affectedUsers: [singleUser]` e `description` mencionando apenas aquele usuário. Quando a UI exibe o card consolidado (95 ocorrências, 4 usuários), ao abrir o detalhe, a descrição mostra apenas os dados de um usuário (cristiane).

### Solução

Adicionar um passo de **consolidação de insights com mesmo `name`** no backend, logo antes de salvar o snapshot. Insights com o mesmo `name` serão mesclados em um único insight com:

- `affectedUsers`: união de todos os usuários
- `count`: soma dos counts individuais
- `severity`: a mais alta entre os insights mesclados
- `description`: resumo geral (ex: "4 usuários com envio anômalo detectado")
- `metadata.userDetails`: array com o detalhe individual de cada usuário (email, count, desvio%)

### Alteração

**`supabase/functions/m365-analyzer/index.ts`** — 1 arquivo

Após a linha ~2308 (depois de `calculateScore`), antes de salvar o snapshot, adicionar uma função `consolidateInsights(allInsights)` que:

1. Agrupa insights pelo campo `name`
2. Para grupos com mais de 1 insight:
   - Merge `affectedUsers` em array único
   - Soma `count`
   - Mantém a `severity` mais alta (critical > high > medium > low)
   - Gera uma `description` genérica: `"${n} usuários detectados com ${name.toLowerCase()}"`
   - Move as descrições originais para `metadata.userDetails` como array de objetos `{ user, description, count }`
   - Preserva a `recommendation` do primeiro insight
3. Insights únicos (sem duplicatas de nome) permanecem inalterados

```text
Antes:
  insight1: { name: "Envio Anômalo", desc: "cristiane enviou 44...", affectedUsers: ["cristiane"], count: 44 }
  insight2: { name: "Envio Anômalo", desc: "julio enviou 20...",    affectedUsers: ["julio"],     count: 20 }
  insight3: { name: "Envio Anômalo", desc: "samuel enviou 18...",   affectedUsers: ["samuel"],    count: 18 }
  insight4: { name: "Envio Anômalo", desc: "jessica enviou 13...",  affectedUsers: ["jessica"],   count: 13 }

Depois:
  insight: {
    name: "Envio Anômalo de Emails",
    description: "4 usuários com envio anômalo detectado. Total: 95 emails.",
    affectedUsers: ["cristiane", "julio", "samuel", "jessica"],
    count: 95,
    severity: "critical",  // a mais alta
    metadata: {
      userDetails: [
        { user: "cristiane", description: "cristiane enviou 44 emails (733% da média diária de 6)", count: 44 },
        { user: "julio",     description: "julio enviou 20 emails ...", count: 20 },
        ...
      ]
    }
  }
```

**`src/components/m365/analyzer/IncidentDetailSheet.tsx`** — atualizar a aba Evidências

Na aba **Evidências**, quando `metadata.userDetails` existir, renderizar uma tabela/lista com o detalhe individual de cada usuário (user, description, count) em vez de apenas listar os nomes. Isso permite ver as informações específicas de cada usuário afetado.

### Arquivos

1. `supabase/functions/m365-analyzer/index.ts` — adicionar `consolidateInsights()` antes do save
2. `src/components/m365/analyzer/IncidentDetailSheet.tsx` — exibir `userDetails` na aba Evidências

