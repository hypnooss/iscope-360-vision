

## Plano: Corrigir layout da página Minha Conta

### Problemas identificados
1. **Margens incorretas**: A página usa `py-6 max-w-2xl` em vez do padrão do sistema `p-6 lg:p-8`
2. **PageBreadcrumb fora do container**: Está fora do `div` de conteúdo, diferente das outras páginas
3. **Tabs desnecessárias**: O conteúdo será exibido em seção única vertical

### Alteração

**`src/pages/AccountPage.tsx`** — Reestruturar para:
- Wrapper `div` com `className="p-6 lg:p-8 space-y-6"` (padrão do sistema)
- `PageBreadcrumb` dentro do wrapper
- Remover componentes `Tabs/TabsList/TabsTrigger/TabsContent`
- Empilhar os 3 Cards verticalmente: Perfil, Segurança, MFA
- Manter `max-w-2xl` apenas nos Cards ou no container de formulários para legibilidade

