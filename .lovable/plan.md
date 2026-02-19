
# Reposicionar Botão de Engrenagem

## Mudança

Mover o botão `<Settings>` (engrenagem) de **antes** do botão "Executar Análise" para **depois** dele, conforme a imagem de referência.

## Ordem atual (incorreta)

```text
[ Workspace ] [ ⚙️ ] [ ▶ Executar Análise ]
```

## Ordem desejada

```text
[ Workspace ] [ ▶ Executar Análise ] [ ⚙️ ]
```

## Alteração técnica

Em `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`, linhas 1529–1550, apenas reordenar os blocos JSX:

1. Mover o bloco do botão `Settings` (linhas 1529–1538) para **depois** dos dois botões condicionais de Executar/Cancelar (linha 1550).

### Antes (simplificado):
```tsx
{/* ⚙️ vem ANTES */}
{isSuperRole && <Button size="icon"><Settings /></Button>}
{isSuperRole && !isRunning && <Button>Executar Análise</Button>}
{isSuperRole && isRunning && <Button>Cancelar Análise</Button>}
```

### Depois (simplificado):
```tsx
{/* Executar/Cancelar ANTES */}
{isSuperRole && !isRunning && <Button>Executar Análise</Button>}
{isSuperRole && isRunning && <Button>Cancelar Análise</Button>}
{/* ⚙️ vem DEPOIS */}
{isSuperRole && <Button size="icon"><Settings /></Button>}
```

## Arquivo modificado

- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`
