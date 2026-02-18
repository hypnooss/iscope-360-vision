
# Botoes Editar e Excluir na tabela de Dominios Externos (Ambiente)

## Resumo

Substituir o botao "Abrir" na coluna Acoes da tabela de Dominios Externos na pagina `/environment` por dois botoes: **Editar** (icone lapis) e **Excluir** (icone lixeira). O botao Excluir abre um modal de confirmacao com palavra aleatoria.

## O que sera feito

### 1. Atualizar `AssetCategorySection` para suportar acoes customizadas

Atualmente o componente renderiza um unico botao "Abrir" para todos os tipos de ativo. Sera adicionada uma prop opcional `renderActions` que, quando fornecida, substitui o botao padrao. Isso permite que a pagina `EnvironmentPage` passe acoes customizadas apenas para dominios externos, sem afetar firewalls e tenants.

### 2. Passar acoes customizadas para a secao de Dominios Externos em `EnvironmentPage`

Na pagina `EnvironmentPage`, a secao de Dominios Externos recebera uma funcao `renderActions` que renderiza:
- **Editar** (icone `Pencil`, `variant="ghost"`, `size="icon"`): navega para `/scope-external-domain/domains/{id}/edit`
- **Excluir** (icone `Trash2`, `variant="ghost"`, `size="icon"`, cor destructive): abre o modal de confirmacao

### 3. Criar modal de exclusao com confirmacao por palavra aleatoria

Novo componente `DeleteEnvironmentDomainDialog` (ou reutilizar/adaptar o existente) que:
- Exibe o nome do dominio a ser excluido
- Informa que todos os dados relacionados (historico de analises, agendamentos, tarefas) serao removidos
- Gera uma palavra aleatoria de 6 caracteres (ex: "abc123") exibida em destaque
- Exige que o usuario digite essa palavra em um campo de input para habilitar o botao "Excluir"
- Ao confirmar, executa deletes em cascata: `external_domain_schedules`, `external_domain_analysis_history`, `agent_tasks` relacionadas, e por fim `external_domains`
- Exibe toast de sucesso e invalida a query para atualizar a tabela

### 4. Logica de exclusao

A exclusao seguira esta ordem:
1. Deletar registros em `external_domain_schedules` onde `domain_id` = id
2. Deletar registros em `external_domain_analysis_history` onde `domain_id` = id
3. Deletar registros em `agent_tasks` onde `target_id` = id e `target_type` = 'external_domain'
4. Deletar o registro em `external_domains` onde `id` = id
5. Invalidar a query `environment-assets` para refresh da tabela

## Detalhes tecnicos

### Arquivos modificados

- **`src/components/environment/AssetCategorySection.tsx`**: Adicionar prop `renderActions?: (asset: AssetItem) => React.ReactNode`. Quando presente, substituir o botao "Abrir" pelo retorno dessa funcao.

- **`src/pages/EnvironmentPage.tsx`**: 
  - Importar `Pencil`, `Trash2` de lucide-react
  - Adicionar estados para o modal de exclusao (`deleteTarget`, `deleteOpen`, `deleteLoading`)
  - Criar funcao `handleDeleteDomain` com a logica de exclusao via Supabase
  - Passar `renderActions` apenas para o `AssetCategorySection` de Dominios Externos

- **`src/components/environment/DeleteEnvironmentDomainDialog.tsx`** (novo arquivo):
  - Modal com `AlertDialog`
  - Gera palavra aleatoria ao abrir (6 caracteres alfanumericos)
  - Campo `Input` para digitar a palavra
  - Botao "Excluir" habilitado somente quando a palavra digitada corresponder
  - Props: `open`, `onOpenChange`, `domainName`, `onConfirm`, `loading`

### Interface `AssetItem` (alteracao)

Adicionar campo `type` ao `AssetItem` para que o `EnvironmentPage` possa identificar o tipo do ativo ao renderizar acoes:

```text
interface AssetItem {
  ...campos existentes...
  type?: string;   // 'firewall' | 'external_domain' | 'm365_tenant'
}
```

### Palavra aleatoria

Gerada com `Math.random().toString(36).substring(2, 8)` ao abrir o dialog, exibida em `font-mono font-bold` dentro de um badge ou destaque visual.
