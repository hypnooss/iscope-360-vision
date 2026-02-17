
# Adicionar botao "Novo Item" com Wizard na pagina Ambiente

## Objetivo

Adicionar um botao "Novo Item" ao lado do seletor de Workspace no header da pagina Ambiente. Ao clicar, abre um Dialog (wizard) onde o usuario primeiro seleciona o tipo de ativo (Dominio Externo, Firewall ou Microsoft 365), e depois e redirecionado para a pagina de criacao correspondente.

## Abordagem

Como cada tipo de ativo ja possui sua propria pagina/dialog de criacao com logica complexa (credenciais, agendamento, OAuth, etc.), o wizard na pagina Ambiente sera um **seletor de tipo** que redireciona o usuario para o fluxo correto. Isso evita duplicar formularios e mantem consistencia.

## Mudancas

### 1. Novo componente: `src/components/environment/AddAssetWizardDialog.tsx`

Um Dialog com:
- **Tela 1 (selecao de tipo)**: 3 cards clicaveis, cada um representando um tipo de ativo:
  - Dominio Externo (icone Globe, cor teal) -- redireciona para `/scope-external-domain/domains` (onde ja existe o dialog de adicionar dominio)
  - Firewall (icone Shield, cor orange) -- redireciona para `/scope-firewall/firewalls/new`
  - Microsoft 365 (icone Cloud, cor blue) -- redireciona para `/scope-m365/tenant-connection` (onde ja existe o wizard de conexao)

- Visual: cards com icone grande, titulo e descricao curta. Ao clicar, o dialog fecha e o usuario e levado para a pagina correspondente.

- O botao trigger sera: `<Button className="gap-2"><Plus className="w-4 h-4" /> Novo Item</Button>` -- seguindo o mesmo padrao do `AddExternalDomainDialog`.

### 2. Alterar: `src/pages/EnvironmentPage.tsx`

- Importar o `AddAssetWizardDialog`
- Adicionar o componente ao lado do seletor de workspace no header (dentro da `div className="flex items-center gap-3"`)
- O botao sera visivel para usuarios com permissao de edicao

### Detalhes tecnicos

- O componente usara `Dialog` do Radix (mesmo padrao do projeto)
- Cards de selecao usarao `Card` com `hover:border-primary` para feedback visual
- Navegacao via `useNavigate()` do react-router-dom
- Nao ha mudanca no banco de dados
