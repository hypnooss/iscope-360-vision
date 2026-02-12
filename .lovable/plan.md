
# Workspace Selector + Validacao no Attack Surface Analyzer

## Objetivo

Adicionar um dropdown de workspace (apenas para Super Admin e Super Suporte) ao lado do botao "Executar Scan", e desabilitar o botao com tooltip caso o workspace selecionado nao tenha pelo menos 1 dominio externo e 1 firewall cadastrados.

## Mudancas

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Workspace Selector (Super Roles)**

Seguindo o padrao ja usado em `GeneralDashboardPage.tsx`:
- Verificar `effectiveRole === 'super_admin' || effectiveRole === 'super_suporte'`
- Se for super role: buscar todos os `clients` (workspaces) e exibir um `Select` dropdown ao lado do botao "Executar Scan"
- Se NAO for super role: usar o `useClientId()` atual (workspace atrelado ao usuario)
- O dropdown nao tera opcao "Todos" — o usuario deve selecionar um workspace especifico para executar o scan
- O `selectedClientId` sera usado tanto para carregar o snapshot quanto para disparar o scan

**2. Validacao de pre-requisitos**

Criar uma query que verifica, para o `selectedClientId`, se existe:
- Pelo menos 1 registro em `external_domains` com `client_id = selectedClientId`
- Pelo menos 1 registro em `firewalls` com `client_id = selectedClientId`

Se alguma das condicoes nao for atendida, o botao "Executar Scan" ficara desabilitado e envolvido por um `Tooltip` com a mensagem:
- "E necessario ter pelo menos um dominio externo e um firewall cadastrados neste workspace para executar o scan."

**3. Layout do header**

O header ficara assim:
```text
[Titulo + Descricao]                    [Workspace Dropdown (se super role)] [Executar Scan]
```

O dropdown e o botao ficarao agrupados com `flex items-center gap-3`.

## Detalhes Tecnicos

### Novo estado e queries na pagina:

- `useEffectiveAuth()` para detectar `effectiveRole`
- `useState` para `selectedWorkspaceId` (super roles)
- `useEffect` para carregar lista de workspaces (`clients` table) — mesmo padrao de `GeneralDashboardPage`
- `useQuery` para verificar existencia de dominio e firewall no workspace selecionado:
  ```typescript
  const { data: prereqs } = useQuery({
    queryKey: ['attack-surface-prereqs', selectedClientId],
    queryFn: async () => {
      const [domains, firewalls] = await Promise.all([
        supabase.from('external_domains').select('id', { count: 'exact', head: true }).eq('client_id', selectedClientId!),
        supabase.from('firewalls').select('id', { count: 'exact', head: true }).eq('client_id', selectedClientId!),
      ]);
      return { hasDomains: (domains.count ?? 0) > 0, hasFirewalls: (firewalls.count ?? 0) > 0 };
    },
    enabled: !!selectedClientId,
  });
  ```

### Logica do `clientId` final:

```text
Se super role:
  clientId = selectedWorkspaceId (do dropdown)
Senao:
  clientId = resultado do useClientId() (workspace do usuario)
```

### Botao com Tooltip condicional:

Quando `prereqs` indica que falta dominio ou firewall, o botao sera envolvido por `Tooltip` com mensagem explicativa. Usar `TooltipProvider` > `Tooltip` > `TooltipTrigger` (com `asChild`) > `Button disabled`.

### Imports adicionais:

- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select`
- `Building2` de `lucide-react` (icone do seletor, consistente com Dashboard)
- `useEffectiveAuth` de `@/hooks/useEffectiveAuth`
- `TooltipProvider` de `@/components/ui/tooltip`
