

## Plan: Exibir permissões em mini-cards estilizados

Alterar a exibição de permissões em ambas as páginas para usar pequenos cards escuros (como no print), com o nome da permissão em destaque e uma descrição abaixo, em vez de listas simples com bullets.

### Dados de descrição das permissões

Criar um mapa compartilhado de descrições para cada permissão, ex:
- `Application.ReadWrite.All` → "Gestão de certificados e credenciais"
- `Directory.Read.All` → "Leitura de diretório e usuários"
- `User.Read.All` → "Leitura de perfis de usuários"
- `Mail.Read` → "Leitura de configurações de e-mail"
- `Organization.Read.All` → "Leitura de dados da organização"
- `Policy.Read.All` → "Leitura de políticas de segurança"
- `RoleManagement.Read.All` → "Leitura de roles e atribuições"
- `SecurityEvents.Read.All` → "Leitura de eventos de segurança"
- etc.

### `src/pages/environment/AddM365TenantPage.tsx`

**Linhas 431-451** — Substituir o grid de categorias com listas por um grid flat de mini-cards (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`). Cada card:
- Fundo `bg-muted/50` com `rounded-lg p-3 border border-border/50`
- Ícone verde `Check` + nome da permissão em `text-xs font-mono font-medium`
- Descrição em `text-xs text-muted-foreground`

Remover o agrupamento por categoria (Entra ID, Exchange, etc.) — exibir todas as permissões Graph em um grid flat.

**Linhas 458-474** — Mesmo tratamento para as roles RBAC, num grid separado abaixo.

### `src/pages/environment/M365TenantEditPage.tsx`

**Linhas 277-297** — Substituir o grid de categorias por mini-cards no mesmo estilo. Cada card mostra o status dot (verde/vermelho/âmbar) + nome + descrição.

**Linhas 302-322** — Mesmo tratamento para roles RBAC.

