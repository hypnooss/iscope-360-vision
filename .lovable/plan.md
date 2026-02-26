

## Limitar lista de desatualizados com ScrollArea (max 5 visíveis)

### Mudança

Envolver a lista de agents/supervisors desatualizados em um `ScrollArea` com altura máxima para ~5 itens, adicionando barra de rolagem quando houver mais.

### Arquivo: `src/pages/admin/SettingsPage.tsx`

**1. Import:** Adicionar `ScrollArea` de `@/components/ui/scroll-area`.

**2. Seção "Agents desatualizados" (linhas 857-871):**
Envolver o `<ul>` dentro de um `<ScrollArea className="max-h-[200px]">` para limitar a 5 itens visíveis (~40px por item).

**3. Seção "Supervisors desatualizados" (linhas 981-994):**
Mesma alteração — envolver o `<ul>` em `<ScrollArea className="max-h-[200px]">`.

### Resultado
Ambas as listas mostram no máximo 5 itens com scroll vertical quando há mais registros.

