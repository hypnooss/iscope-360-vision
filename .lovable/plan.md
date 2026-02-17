

# Traduzir status para PT-BR e reordenar seções

## Mudanças

### 1. Traduzir status para português (`AssetCategorySection.tsx`)

Criar um mapa de tradução de status para exibição em português:

| Status original | Tradução |
|----------------|----------|
| analyzed | Analisado |
| pending | Pendente |
| partial | Parcial |
| connected | Conectado |
| disconnected | Desconectado |
| error | Erro |
| active | Ativo |

O Badge de status usará o valor traduzido em vez do valor cru do banco.

### 2. Status "Pendente" nos Domínios Externos

Os domínios externos realmente possuem status `pending` no banco de dados. Isso é correto -- significa que ainda não foram analisados. A tradução para "Pendente" refletirá isso corretamente. Porém, como eles possuem score (89%, 83%), faz sentido que domínios com score sejam exibidos como "Analisado". Será aplicada a mesma lógica usada nos firewalls: se `last_score` não é nulo, o status será `analyzed` independente do campo `status` da tabela.

### 3. Reordenar seções (`EnvironmentPage.tsx`)

Trocar a ordem das seções para seguir o menu:
1. Domínios Externos
2. Firewalls
3. Tenants M365

Também reordenar os stats cards na mesma sequência.

### Detalhes técnicos

- **`AssetCategorySection.tsx`**: Adicionar função `translateStatus(status: string): string` com o mapa de traduções
- **`EnvironmentPage.tsx`** (linha 120): Alterar lógica de status dos external_domains para usar `ed.last_score !== null ? 'analyzed' : ed.status`
- **`EnvironmentPage.tsx`** (linhas 260-285): Reordenar os 3 `AssetCategorySection` para Domínios Externos, Firewalls, M365
- **`EnvironmentPage.tsx`** (stats cards): Reordenar para Domínios Externos, Firewalls, M365
