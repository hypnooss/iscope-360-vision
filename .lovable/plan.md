

## Reordenar elementos na seção "Composição do Diretório"

Trocar a ordem dentro da seção "Composição do Diretório": cards primeiro, barra proporcional depois.

### Layout final

```
[Badge: Resumo do Diretório]
[Total] [Habilitados] [Desabilitados]
[Progress: Sign-in habilitado XX%]

[Badge: Composição do Diretório]
[Cloud-Only] [Sincronizados] [Convidados]
[ProportionalBar: Cloud | Sync | Guests]
```

### Alteração

**`src/components/m365/entra-id/EntraIdCategorySheet.tsx`** (linhas 108-120):
- Mover o bloco `ProportionalBar` (linhas 110-114) para **depois** do grid de cards (linhas 115-119)
- Seção 1 permanece inalterada

