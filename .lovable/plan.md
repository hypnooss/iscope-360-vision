

## Plano: Mover lista "sem módulo" para depois da lista de desatualizados

### Problema
No `renderStatusSection`, o bloco `{extra}` (que contém "sem Supervisor/Monitor") aparece **antes** da lista de desatualizados. O correto é aparecer **depois**.

### Solução
Em `renderStatusSection` (linha ~401-419), trocar a ordem: mover `{extra}` para depois do bloco `{outdated.length > 0 && ...}`.

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/UpdateManagementCard.tsx` (linhas 401-419) | Mover `{extra}` de antes para depois do bloco de desatualizados |

