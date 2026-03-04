

## Melhorar exibição da coluna "Atributo" nas Alterações de Configuração

### Problema

O campo `cfgattr` vem direto do log do FortiGate em formato técnico como `nat[disable->enable]`, `dstaddr[all->VIP_SAPIENSWEB_Externo_HTTP_WAN2 VIP_EDOCS_Externo...]`, `match:1[<Delete>server-name[SRVW19DC01]group-name[CN=G_WIFI...]]`. Isso é ilegível para humanos e fica truncado na célula.

### Solução

Substituir a tabela flat por um layout com **linha expandível** — cada row mostra os dados principais (Data, Usuário, Ação, Categoria, Objeto, Severidade) e ao clicar, expande uma área abaixo com os detalhes formatados:

1. **Criar função `parseConfigAttribute`** que transforma o formato raw do FortiGate em dados legíveis:
   - `nat[disable->enable]` → Campo: `nat`, Anterior: `disable`, Novo: `enable`
   - `dstaddr[all->VIP_A VIP_B]` → Campo: `dstaddr`, Anterior: `all`, Novo: lista formatada
   - `status[disable->enable]name[...]` → Múltiplas alterações detectadas e listadas
   - Strings sem pattern `[...]` exibidas como texto livre

2. **Reformatar a tabela**:
   - Remover coluna "Atributo" da tabela principal (fica truncada e ilegível)
   - Remover coluna "Path" da tabela principal (mover para detalhes)
   - Adicionar ícone de expand/collapse (ChevronDown) na primeira coluna
   - Ao expandir a row, mostrar abaixo uma área com:
     - **Path**: `firewall.policy`
     - **Alterações**: Lista formatada das mudanças parseadas do `cfgattr`
     - **Mensagem original**: `msg` (se disponível), em texto mono menor

3. **Formatação visual das mudanças**:
   - Valor anterior em vermelho/riscado
   - Valor novo em verde
   - Seta `→` entre valores
   - Múltiplos campos separados visualmente

### Arquivo alterado

**`src/pages/firewall/AnalyzerConfigChangesPage.tsx`**:
- Adicionar helper `parseConfigAttribute(raw: string)` que retorna `Array<{field, oldVal?, newVal?, raw?}>`
- Adicionar state `expandedRows: Set<string>`
- Reestruturar `<TableBody>` para cada row renderizar 2 `<TableRow>` (principal + detalhes condicionais)
- Reduzir colunas visíveis: Data/Hora, Usuário, Ação, Categoria, Objeto, Severidade, expand icon
- Row de detalhes com `colSpan` full exibindo Path + Atributos parseados + msg

