

# Plano: Substituir Aviso de Conexão Centralizada por Aviso de Propagação

## Alteração

Substituir o card informativo atual por um aviso sobre o tempo de propagação das permissões do Azure AD.

## Código Atual (linhas 338-353)

```tsx
<Card className="mb-6 border-blue-500/20 bg-blue-500/5">
  <CardContent className="py-4">
    <div className="flex gap-3">
      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Conexão Centralizada</p>
        <p className="text-sm text-muted-foreground">
          A conexão do tenant é compartilhada entre todos os submódulos do Microsoft 365 
          (Entra ID, SharePoint, Exchange, Defender, Intune). Configure uma vez e 
          utilize em todos os módulos.
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

## Novo Código

```tsx
<Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
  <CardContent className="py-4">
    <div className="flex gap-3">
      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Tempo de Propagação do Azure</p>
        <p className="text-sm text-muted-foreground">
          Após conectar um tenant, as permissões do Admin Consent podem levar até 15 minutos 
          para propagar completamente no Azure. Se o status aparecer como "Pendente", 
          aguarde alguns minutos e clique no botão <strong>"Testar"</strong> para validar a conexão.
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

## Mudanças Visuais

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cor do card | Azul | Amarelo (alerta) |
| Ícone | `Info` | `AlertCircle` |
| Título | "Conexão Centralizada" | "Tempo de Propagação do Azure" |
| Conteúdo | Sobre submódulos compartilhados | Sobre propagação e uso do botão Testar |

## Arquivo a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/m365/TenantConnectionPage.tsx` | 338-353 | Substituir conteúdo do Info Card |

Nota: O ícone `AlertCircle` já está importado (linha 23), então não é necessário adicionar novos imports.

