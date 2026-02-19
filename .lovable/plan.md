

# Filtrar Ações de Sistema na Tabela de Alterações de Configuração

## Problema

A tabela exibe todas as entradas do log de configuração, incluindo ações automáticas do sistema (ex: `delete_phase1_sa` de IPsec SA lifecycle, entradas com usuário `unknown`). O objetivo é mostrar apenas alterações feitas por usuários humanos (administradores).

## Lógica de Filtragem

No FortiGate, ações de sistema se identificam por:
- **Usuário "unknown"**: eventos gerados automaticamente pelo sistema
- **Ações de SA (Security Association)**: `delete_phase1_sa`, `delete_phase2_sa`, `add_phase1_sa`, `add_phase2_sa` -- são eventos automáticos do ciclo de vida IPsec, não ações de administrador

Ações de administrador legítimas têm:
- Usuário identificado (ex: `gdm-admin`, IPs de sessão admin)
- Ações como `Edit`, `Add`, `Delete` (em contexto de configuração)

## Filtro Proposto

Excluir entradas onde:
1. `user === "unknown"` ou `user` estiver vazio
2. `action` contenha padrões de SA automático: `phase1_sa`, `phase2_sa`

Isso será aplicado **antes** dos filtros de busca do usuário, na extração dos `details` do snapshot.

## Mudança Técnica

### Arquivo: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

Na linha 85, onde os `details` são extraídos:

```typescript
// Antes
const details: ConfigChangeDetail[] = (snapshot?.metrics?.configChangeDetails as any) || [];

// Depois - filtrar ações de sistema
const SYSTEM_ACTION_PATTERNS = ['phase1_sa', 'phase2_sa'];
const allDetails: ConfigChangeDetail[] = (snapshot?.metrics?.configChangeDetails as any) || [];
const details = allDetails.filter(d => {
  if (!d.user || d.user === 'unknown') return false;
  if (SYSTEM_ACTION_PATTERNS.some(p => d.action?.toLowerCase().includes(p))) return false;
  return true;
});
```

O contador no header também será atualizado para refletir apenas as alterações de usuário (não mais o `configChangesCount` bruto do snapshot).

## Resultado

A tabela mostrará apenas alterações feitas por administradores identificados (como `gdm-admin` fazendo `Edit` em `log.setting`), ocultando eventos automáticos do sistema como renegociações IPsec.

