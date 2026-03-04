

## Correções no Parser de Atributos de Configuração

### Problemas Identificados

1. **Colchetes soltos** (print 1): O regex `([a-zA-Z0-9_.:/-]+)\[([^\]]*)\]` não lida com estruturas aninhadas como `match:1[<Delete>server-name[SRVW19DC01]group-name[CN=...]]`. O colchete de fechamento mais externo fica como texto residual, gerando `]` soltos na UI.

2. **Conteúdo indistinguível** (prints 2 e 3): Quando o cfgattr não segue o padrão `field[old->new]` (ex: `[001]: WT008064dc32d0...` ou `guest:14 password[*`), o parser joga tudo como `raw` sem formatação útil — fica um bloco cinza ilegível.

3. **Ação ausente na row expandida**: O tipo de ação (Edit, Add, Delete) não aparece nos detalhes expandidos.

### Solução

**Arquivo**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **Melhorar o parser `parseConfigAttribute`**:
   - Usar um parser que lida com colchetes aninhados (contar profundidade de `[`/`]`) em vez de regex simples
   - Filtrar resultados que são apenas `]` ou whitespace
   - Para campos com `<Delete>` aninhado, extrair sub-campos recursivamente
   - Para strings sem pattern reconhecido, mostrar como bloco formatado sem colchetes residuais

2. **Limpar colchetes órfãos**:
   - Antes de exibir `raw`, fazer trim de `]` e `[` nas bordas
   - Ignorar entries onde `field` e `raw` são apenas pontuação

3. **Adicionar Ação na row expandida**:
   - Exibir `d.action` como Badge logo após o Path nos detalhes expandidos (ex: `Ação: Edit`)

4. **Melhor formatação de raw não-parseável**:
   - Quando o campo é uma lista longa de IDs/MACs (print 2), quebrar em tokens separados por espaço e mostrar em layout wrap
   - Para `password[*]`, mostrar como "password: (protegido)"

