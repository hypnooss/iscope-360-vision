

# Botao "Testar" no Card do Attack Surface Analyzer

## O que muda

Cada card de IP/ativo no Attack Surface Analyzer ganha um botao discreto "Testar" (visivel apenas para super_admin / super_suporte). Ao clicar, o sistema cria um snapshot + task apenas para aquele IP, permitindo re-scanear um ativo especifico sem executar o scan do workspace inteiro.

## Plano Tecnico

### 1. Nova Edge Function: `attack-surface-rescan-ip`

Cria uma edge function dedicada que recebe `client_id`, `ip`, `source` e `label`, e:

1. Cria um novo `attack_surface_snapshots` com `status: 'pending'` e `source_ips` contendo apenas o IP informado
2. Cria uma unica `attack_surface_tasks` vinculada ao snapshot
3. Retorna o `snapshot_id` criado

```typescript
// supabase/functions/attack-surface-rescan-ip/index.ts
// Body: { client_id, ip, source, label }
// Cria snapshot + 1 task para o IP especifico
```

### 2. Hook de mutacao no frontend

**Arquivo:** `src/hooks/useAttackSurfaceData.ts`

Adicionar um novo hook `useAttackSurfaceRescanIP` que:
- Recebe `clientId`
- Expoe `mutate({ ip, source, label })`
- Invalida as queries de snapshot apos sucesso
- Mostra toast de sucesso/erro

### 3. Botao "Testar" no AssetCard

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Na funcao `AssetCard`, adicionar um botao discreto ao lado do chevron (canto direito do card):

- Visivel apenas quando `isSuperRole === true`
- Botao `ghost` com icone `Play` e texto "Testar" em tamanho pequeno
- Usa `e.stopPropagation()` para nao abrir/fechar o card ao clicar
- Mostra `Loader2` durante o loading da mutacao

Posicao: entre os badges de CVE e o chevron, no canto inferior direito do summary row.

```text
+-----------------------------------------------------------------+
| (globe) vpn.nexta.com.br  34.95.238.67  AS13335   [CRITICAL] > |
|   6 portas . 9 servicos . Cert Valido . FortiSSH . HSTS        |
|   5 Critical                                     [Testar]       |
+-----------------------------------------------------------------+
```

O botao recebe as props necessarias: `ip`, `source` (do `source_ips` do snapshot), `label` (hostname).

### 4. Passar dados para o AssetCard

Para que o botao tenha acesso ao `source` e `label`, o `ExposedAsset` precisa de um campo extra `source`:

```typescript
interface ExposedAsset {
  // ... campos existentes ...
  source: 'dns' | 'firewall';  // NOVO - de onde veio o IP
}
```

Na funcao `buildAssets`, extrair o `source` do `source_ips` do snapshot.

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/attack-surface-rescan-ip/index.ts` | Nova edge function (cria snapshot + task para 1 IP) |
| `src/hooks/useAttackSurfaceData.ts` | Novo hook `useAttackSurfaceRescanIP` |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Adicionar `source` ao `ExposedAsset`, botao "Testar" no `AssetCard` (apenas super roles) |

