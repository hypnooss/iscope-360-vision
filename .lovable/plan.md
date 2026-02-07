

# Adicionar submódulos ao menu do Microsoft 365

## Problema
O menu lateral do módulo Microsoft 365 mostra apenas 4 itens (Tenants, Execuções, Relatórios, Entra ID), mas faltam os submódulos **Exchange Online** e **Postura de Segurança** que já possuem páginas e rotas criadas.

## Solução
Adicionar os dois itens faltantes na configuração de navegação do M365 em `src/components/layout/AppLayout.tsx`.

## Alteração

**Arquivo:** `src/components/layout/AppLayout.tsx`

Na seção `scope_m365` (linhas 123-132), adicionar:
- **Postura de Segurança** apontando para `/scope-m365/posture` (ícone: ShieldCheck)
- **Exchange Online** apontando para `/scope-m365/exchange-online` (ícone: Mail/Monitor)

O menu ficará assim:
1. Tenants
2. Postura de Segurança
3. Entra ID
4. Exchange Online
5. Execuções
6. Relatórios

Os itens de "produto" (Postura, Entra ID, Exchange) ficam agrupados no meio, e os operacionais (Execuções, Relatórios) ficam ao final.

## Detalhes Técnicos
- Importar o ícone `Mail` do lucide-react (para Exchange Online)
- Reordenar os itens do array `items` dentro de `knownModuleNavConfigs['scope_m365']`
- Também atualizar o `isActiveRoute` para que subpáginas do Entra ID (como `/scope-m365/entra-id/security-insights`) marquem o item "Entra ID" como ativo, usando `startsWith` em vez de igualdade exata
