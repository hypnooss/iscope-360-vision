
# Transformar modal "Novo Item" em pagina dedicada

## Resumo

Converter o dialog/modal `AddAssetWizardDialog` em uma pagina completa (`/environment/new`), seguindo o mesmo padrao visual da tela "Fontes de CVE": breadcrumb, botao de voltar ao lado do titulo, e layout consistente com o resto do sistema.

## Mudancas

### 1. Nova pagina: `src/pages/AddAssetPage.tsx`

Criar uma pagina dedicada com:
- `AppLayout` como wrapper
- `PageBreadcrumb` com itens: Ambiente > Novo Item
- Botao de voltar (ArrowLeft, ghost, navega para `/environment`) ao lado do titulo
- Titulo: "Adicionar Novo Item"
- Subtitulo: "Selecione o tipo de ativo que deseja adicionar ao ambiente."
- Os 3 cards de selecao (Dominio Externo, Firewall, Microsoft 365) reutilizando a mesma logica e visual do dialog atual

O layout seguira exatamente o padrao do `CVESourcesPage.tsx` (linhas 185-208).

### 2. Alterar: `src/App.tsx`

Adicionar rota `/environment/new` apontando para o novo `AddAssetPage`.

### 3. Alterar: `src/pages/EnvironmentPage.tsx`

Trocar o `<AddAssetWizardDialog />` por um `<Button>` que navega para `/environment/new`:

```text
<Button className="gap-2" onClick={() => navigate('/environment/new')}>
  <Plus className="w-4 h-4" />
  Novo Item
</Button>
```

### 4. Remover: `src/components/environment/AddAssetWizardDialog.tsx`

O componente de dialog nao sera mais necessario e sera removido.

### Detalhes tecnicos

- A pagina usa `useNavigate` para o botao voltar e para os cards de selecao
- Nenhuma mudanca no banco de dados
- Os cards de selecao mantem as mesmas rotas de destino (`/scope-external-domain/domains`, `/scope-firewall/firewalls/new`, `/scope-m365/tenant-connection`)
