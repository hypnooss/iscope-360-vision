

## Diferenças encontradas

| Aspecto | Firewall | Entra ID |
|---------|----------|----------|
| Padding | `px-6 py-3` | `p-4` |
| Título | `text-base` (16px) | `text-lg` (18px) |
| Ícone X | `w-4 h-4`, botão `h-8 w-8` | `w-5 h-5`, botão `p-2` |
| Background | `bg-black/40 backdrop-blur-md` | tema padrão (`bg-background`) |

## Plano

Padronizar a barra do **Entra ID** para usar o mesmo estilo do **Firewall**, que é mais compacto e consistente com o tema escuro do mapa:

### `src/components/m365/entra-id/EntraIdLoginMap.tsx`

- Mudar padding da barra de `p-4` → `px-6 py-3`
- Mudar título de `text-lg` → `text-base`
- Mudar background da barra para `bg-black/40 backdrop-blur-md border-white/10`
- Mudar ícone X de `w-5 h-5` → `w-4 h-4` com botão `h-8 w-8`
- Mudar cor do título para `text-white` (igual Firewall)

Apenas ajustes de classes CSS, sem mudança funcional.

