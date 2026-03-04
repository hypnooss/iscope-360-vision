

## Formatadores Específicos por cfgpath

### Problema

O parser genérico `parseConfigAttribute` tenta tratar todos os formatos de `cfgattr` com a mesma lógica de `field[content]`, mas o FortiGate gera formatos completamente diferentes dependendo do `cfgpath`:

- `firewall.policy` → `nat[disable->enable]status[enable->disable]` (field[old->new])
- `user.group` → `guest:6 user-id: email, name: Nome, company: X, ...` (key-value livre)
- `firewall.vip` → `match:1[<Delete>server-name[...]]` (nested com Delete)
- Listas de MACs/IDs sem pattern

O parser genérico produz resultados estranhos quando aplicado a formatos que não são `field[bracket]`.

### Solução

Criar um sistema de **formatadores por cfgpath** com fallback genérico:

**Arquivo**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **Criar `formatByPath(cfgpath, cfgattr, action)` dispatcher**:
   - Recebe o path e despacha para o formatador adequado
   - Fallback para o parser genérico atual quando não há formatador específico

2. **Formatadores específicos**:
   - **`user.*` paths** (user.group, user.local, etc.): Detectar pattern `guest:N key: value, key: value` e formatar como lista de campos key-value em layout limpo
   - **`firewall.policy` / `firewall.address`**: Manter o parser atual de `field[old->new]` (funciona bem)
   - **`firewall.vip`**: Parser com suporte a nested brackets e `<Delete>` (já existe, refinar)
   - **Listas brutas** (MACs, IDs sem pattern): Tokenizar por espaço e mostrar em wrap com chips

3. **Formatador `user.*`** — parse específico:
   - Separar por `, ` para obter pares `key: value`
   - Se começa com `guest:N` ou `member:N`, extrair como identificador
   - Renderizar como mini-tabela ou lista de definição (`dl/dt/dd`)

4. **Manter a Badge de Ação** na row expandida (já implementado)

5. **Fallback melhorado**: Para cfgattr que não casa com nenhum pattern, exibir o texto original formatado com quebras de linha em key-value quando possível (split por `, ` se contém `: `)

### Resultado Esperado

- `user.group` com `guest:6 user-id: email, name: Nome...` → Lista formatada: user-id: email, name: Nome, etc.
- `firewall.policy` com `nat[disable->enable]` → Mantém visual atual (vermelho→verde)
- Paths desconhecidos → Texto limpo sem colchetes soltos

