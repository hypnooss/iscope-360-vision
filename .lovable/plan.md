

# Plano: Correção da Página de Relatórios de Firewall

## Problema Identificado

A página **Firewall > Relatórios** (`/scope-firewall/reports`) não exibe nenhum conteúdo devido a um **race condition** na lógica de carregamento.

## Análise Técnica

### Causa Raiz

No arquivo `src/pages/firewall/FirewallReportsPage.tsx`, o `useEffect` que dispara o `fetchReports()` tem dependências incompletas:

```typescript
// Linhas 73-77 - Código atual com problema
useEffect(() => {
  if (user && hasModuleAccess('scope_firewall')) {
    fetchReports();
  }
}, [user]); // <- Falta a dependência!
```

### Sequência do Bug

1. O usuário navega para `/scope-firewall/reports`
2. O componente monta e o `useEffect` executa
3. Neste momento, o `AuthContext` ainda está carregando e `role = null`
4. `hasModuleAccess('scope_firewall')` retorna `false` porque `role !== 'super_admin'`
5. `fetchReports()` não é chamado
6. O `AuthContext` termina de carregar e define `role = 'super_admin'`
7. O `useEffect` **NÃO re-executa** porque `user` não mudou
8. A página fica em branco com o spinner infinito (loading: true)

### Evidências

- Consulta SQL confirmou: usuário `bd66346a-44fc-47b1-a09b-2014a53539b6` tem role `super_admin`
- Logs de rede **não mostram** requisição para `analysis_history`
- Base de dados tem 9 análises disponíveis

---

## Solucao Proposta

### Arquivo: `src/pages/firewall/FirewallReportsPage.tsx`

#### 1. Importar o loading do ModuleContext

Adicionar `loading` aos imports do hook:

```typescript
const { hasModuleAccess, loading: moduleLoading } = useModules();
```

#### 2. Corrigir o useEffect de carregamento de relatórios

Atualizar as dependências e condições:

```typescript
useEffect(() => {
  // Só buscar quando auth e módulos estiverem prontos
  if (!authLoading && !moduleLoading && user && hasModuleAccess('scope_firewall')) {
    fetchReports();
  }
}, [user, authLoading, moduleLoading]);
```

#### 3. Atualizar o useEffect de navegação

Garantir que a navegação só aconteça quando tudo estiver carregado:

```typescript
useEffect(() => {
  if (authLoading || moduleLoading) return;
  
  if (!user) {
    navigate('/auth');
    return;
  }
  
  if (!hasModuleAccess('scope_firewall')) {
    navigate('/modules');
  }
}, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);
```

#### 4. Mostrar loading durante carregamento inicial

Atualizar o return inicial:

```typescript
if (authLoading || moduleLoading) {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );
}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Página em branco com spinner infinito | Carrega corretamente após auth/módulos prontos |
| `fetchReports()` nunca executado | `fetchReports()` executa quando `role` está disponível |
| 0 requisições para `analysis_history` | Requisição disparada e dados exibidos |

---

## Arquivos Modificados

- `src/pages/firewall/FirewallReportsPage.tsx`

## Complexidade

- Baixa - Correção pontual de dependências de useEffect

