

## Consolidar Sheet "Usuários Ativos" em tela única

### Problema
As 3 abas repetem os mesmos números (Cloud-Only, Sincronizados, Convidados aparecem múltiplas vezes). Informação redundante e fragmentada.

### Solução
Remover as `Tabs` e exibir tudo em uma única view scrollável com seções visuais claras:

**Seção 1 — Resumo do Diretório**
- 3 cards em linha: Total | Habilitados (verde) | Desabilitados (vermelho)
- Progress bar: Sign-in habilitado (%)

**Seção 2 — Composição do Diretório**
- Barra proporcional com 3 segmentos: Cloud-Only (sky) | Sincronizados (violet) | Convidados (pink)
- Legenda com valores absolutos e percentuais
- 3 cards em linha com ícones: Cloud-Only | Sincronizados | Convidados

### Arquivo alterado
- `src/components/m365/entra-id/EntraIdCategorySheet.tsx` — substituir o bloco `case 'active_users'` removendo Tabs e unificando o conteúdo

