
# Plano: Adicionar Domínios Externos ao Modal de Detalhes do Workspace

## Problema Identificado

No modal "Detalhes do Workspace" (acessado pelo ícone de olho em Administração > Workspaces), são exibidos:
- Firewalls
- Microsoft 365 Tenants  
- Agents

**Faltando:** Domínios Externos não estão sendo buscados nem exibidos.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientsPage.tsx` | Adicionar busca e exibição de External Domains |

---

## Alterações Técnicas

### 1. Adicionar Interface para External Domain (após linha 58)

```typescript
interface ExternalDomain {
  id: string;
  name: string;
  domain: string;
  last_score: number | null;
  status: string;
}
```

### 2. Atualizar Interface WorkspaceDetails (linha 60-64)

```typescript
interface WorkspaceDetails {
  firewalls: Firewall[];
  tenants: M365Tenant[];
  agents: Agent[];
  externalDomains: ExternalDomain[];  // NOVO
}
```

### 3. Adicionar Import do Ícone Globe (linha 25)

```typescript
import { Building, Plus, Loader2, Pencil, Trash2, Eye, Shield, Cloud, Bot, Globe } from "lucide-react";
```

### 4. Atualizar fetchData para contar External Domains (linhas 120-133)

```typescript
const clientsWithCounts = await Promise.all(
  (clientsData || []).map(async (client) => {
    const [firewallsResult, tenantsResult, agentsResult, domainsResult] = await Promise.all([
      supabase.from("firewalls").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("m365_tenants").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("agents").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("external_domains").select("id", { count: "exact", head: true }).eq("client_id", client.id),
    ]);

    return {
      ...client,
      scopes_count: (firewallsResult.count || 0) + (tenantsResult.count || 0) + (domainsResult.count || 0),
      agents_count: agentsResult.count || 0,
    };
  }),
);
```

### 5. Atualizar openViewDialog para buscar External Domains (linhas 248-271)

```typescript
const openViewDialog = async (client: Client) => {
  setViewingClient(client);
  setViewDialogOpen(true);
  setLoadingDetails(true);

  try {
    const [firewallsRes, tenantsRes, agentsRes, domainsRes] = await Promise.all([
      supabase
        .from("firewalls")
        .select("id, name, description, last_score")
        .eq("client_id", client.id)
        .order("name"),
      supabase
        .from("m365_tenants")
        .select("id, display_name, tenant_domain, connection_status")
        .eq("client_id", client.id)
        .order("display_name"),
      supabase
        .from("agents")
        .select("id, name, last_seen, revoked")
        .eq("client_id", client.id)
        .order("name"),
      supabase
        .from("external_domains")
        .select("id, name, domain, last_score, status")
        .eq("client_id", client.id)
        .order("name"),
    ]);

    setWorkspaceDetails({
      firewalls: firewallsRes.data || [],
      tenants: tenantsRes.data || [],
      agents: agentsRes.data || [],
      externalDomains: domainsRes.data || [],
    });
  } catch (error) {
    console.error("Erro ao buscar detalhes:", error);
    toast.error("Erro ao carregar detalhes do workspace");
  } finally {
    setLoadingDetails(false);
  }
};
```

### 6. Adicionar Seção de External Domains no Modal (após a seção de M365 Tenants, ~linha 539)

```tsx
{/* External Domains */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Globe className="w-4 h-4 text-primary" />
    <h4 className="font-medium">Domínios Externos ({workspaceDetails?.externalDomains.length || 0})</h4>
  </div>
  {workspaceDetails?.externalDomains.length === 0 ? (
    <p className="text-sm text-muted-foreground pl-6">Nenhum domínio externo vinculado</p>
  ) : (
    <div className="space-y-2 pl-6">
      {workspaceDetails?.externalDomains.map((domain) => (
        <div key={domain.id} className="p-3 rounded-md bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{domain.name}</p>
              <p className="text-xs text-muted-foreground">{domain.domain}</p>
            </div>
            <div className="flex items-center gap-2">
              {domain.last_score !== null && (
                <Badge variant={domain.last_score >= 70 ? "default" : domain.last_score >= 40 ? "secondary" : "destructive"}>
                  Score: {domain.last_score}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

---

## Ordem dos Objetos no Modal

Após a alteração, o modal exibirá na seguinte ordem:

1. **Informações do Workspace** (nome, descrição, ID)
2. **Firewalls** - com ícone Shield
3. **Microsoft 365 Tenants** - com ícone Cloud
4. **Domínios Externos** - com ícone Globe (NOVO)
5. **Agents** - com ícone Bot

---

## Resultado Esperado

Ao clicar no ícone de visualizar um Workspace, o modal exibirá uma nova seção "Domínios Externos" mostrando:
- Nome do domínio
- URL/domínio
- Score da última análise (se houver)

O contador de "Escopos" na tabela também será atualizado para incluir a contagem de domínios externos.
