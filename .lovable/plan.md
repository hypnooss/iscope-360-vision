

# Ajustes no AssetHealthGrid: Padding Interno e Botao Testar

## Resumo
Duas alteracoes no componente AssetHealthGrid:
1. Aumentar o padding esquerdo interno dos cards (espaco entre a borda esquerda colorida e o conteudo)
2. Adicionar o botao "Testar" (re-scan individual por IP) que existia na v1

## Detalhes tecnicos

**Arquivo 1**: `src/components/surface/AssetHealthGrid.tsx`

### 1. Aumentar padding esquerdo
Alterar `px-3` para `pl-5 pr-3` em ambos os tipos de card (ok e com achados), criando mais espaco entre a borda esquerda colorida (border-l-4) e as tres linhas de conteudo.

### 2. Adicionar botao Testar
- Adicionar novas props ao componente: `onRescan`, `rescannigIp`, e `isSuperRole`
- `onRescan(ip: string, hostname: string)`: callback para disparar o re-scan
- `rescanningIp: string | null`: IP sendo re-escaneado no momento (para mostrar spinner)
- `isSuperRole: boolean`: controla visibilidade do botao (apenas super_admin e super_suporte)
- Renderizar um botao ghost com icone Play (ou Loader2 quando ativo) e texto "Testar" no canto inferior direito de cada card, visivel apenas para super roles
- O botao usa `e.stopPropagation()` para nao acionar o `onAssetClick`

**Arquivo 2**: `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

### Conectar o botao Testar ao hook existente
- Importar `useAttackSurfaceRescanIP` de `@/hooks/useAttackSurfaceData`
- Instanciar `rescanMutation` com o `selectedClientId`
- Passar as novas props para `AssetHealthGrid`:
  - `isSuperRole`: ja existe na pagina
  - `rescanningIp`: estado local para rastrear qual IP esta sendo re-escaneado
  - `onRescan`: funcao que chama `rescanMutation.mutate()` com ip, source, label e snapshotId do snapshot ativo

