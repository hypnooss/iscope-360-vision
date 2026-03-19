

## Melhorar espaçamento e diferenciação visual dos cards de atualização

### Problema
Os três blocos (Agent, Supervisor, Monitor) estão visualmente muito similares e próximos, dificultando a distinção rápida.

### Solução

Aplicar cores temáticas distintas para cada seção e aumentar o espaçamento entre elas.

**1. Espaçamento** — Aumentar `space-y-8` para `space-y-12` no `CardContent`, e adicionar um `Separator` (ou `<hr>`) entre cada row.

**2. Cores temáticas por seção:**

| Seção | Cor accent | Aplicação |
|---|---|---|
| **Agent** | `blue` | Borda do card, botão, switch, badge |
| **Supervisor** | `purple/violet` | Borda do card, botão, switch, badge |
| **Monitor** | `emerald/teal` | Borda do card, botão, switch, badge |

**3. Modificar `renderPublishSection`** para aceitar um parâmetro `colorClass` (ex: `'blue'`, `'violet'`, `'emerald'`) e aplicar:
- `border-l-4 border-l-{color}-500` no container do card
- `bg-{color}-500/5` como background sutil
- Botão com `bg-{color}-600 hover:bg-{color}-700` (ou classe customizada)
- Switch com cor accent correspondente via wrapper class

**4. Modificar `renderStatusSection`** para aceitar o mesmo `colorClass` e aplicar:
- `border-l-4 border-l-{color}-500` matching
- `bg-{color}-500/5` background sutil

**5. Badges no header** — Colorir cada badge com a cor da respectiva seção (Agent azul, Supervisor violeta, Monitor verde).

### Arquivo editado
`src/components/admin/UpdateManagementCard.tsx`

