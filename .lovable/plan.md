

# Plano: Ajustar Wizard de Conexão de Tenant + Correção OAuth

## Resumo

Este plano aborda duas questões:
1. **Padronização visual** do wizard de conexão de tenant para seguir os mesmos padrões dos dialogs de administração
2. **Correção do erro OAuth** - configuração necessária no Azure Portal

---

## Parte 1: Erro OAuth (AADSTS50011 - Redirect URI Mismatch)

### Diagnóstico

O erro indica que a URL de callback enviada na requisição OAuth **não está cadastrada** no Azure App Registration:

```text
URL enviada: https://pgjervwrvmfmwvfvylvj.supabase.co/functions/v1/m365-oauth-callback
App ID: 800e141d-2dd6-4fa7-b19b-4a284f584d32
```

### Solução (Configuração no Azure Portal)

Este **NÃO é um problema de código**. É necessário configurar a Redirect URI no Azure:

1. Acessar [Azure Portal](https://portal.azure.com)
2. Navegar para **Azure Active Directory → App Registrations**
3. Localizar o aplicativo com ID: `800e141d-2dd6-4fa7-b19b-4a284f584d32`
4. Ir para **Authentication** no menu lateral
5. Na seção **Platform configurations → Web**, adicionar:
   ```
   https://pgjervwrvmfmwvfvylvj.supabase.co/functions/v1/m365-oauth-callback
   ```
6. Salvar as alterações

**Importante**: A URI deve ser EXATAMENTE igual, incluindo o protocolo `https://` e sem barra final.

---

## Parte 2: Padronização Visual do Wizard

### Alterações no Arquivo

**Arquivo**: `src/components/m365/TenantConnectionWizard.tsx`

### Mudanças de Estrutura

| Elemento | Atual | Novo (Padrão) |
|----------|-------|---------------|
| DialogContent | `max-w-2xl max-h-[90vh]` | `max-w-lg border-border/50` |
| Conteúdo | Sem ScrollArea | `ScrollArea` com `max-h-[60vh]` |
| Padding interno | Variado | `px-6 py-4` consistente |
| DialogTitle | Texto simples | Ícone + Texto (`flex items-center gap-2`) |
| Cards informativos | `bg-green-500/5` | `bg-muted/30 border border-border/50` |

### Detalhes das Mudanças

#### 1. DialogContent (linha ~560)
```tsx
// De:
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

// Para:
<DialogContent className="max-w-lg border-border/50">
```

#### 2. DialogHeader (linhas ~561-566)
```tsx
// De:
<DialogTitle>Conectar Tenant Microsoft 365</DialogTitle>

// Para:
<DialogTitle className="flex items-center gap-2">
  <Globe className="w-5 h-5" />
  Conectar Tenant Microsoft 365
</DialogTitle>
```

#### 3. Step Content Container (linha ~613-616)
```tsx
// De:
<div className="py-4 min-h-[300px]">
  {renderStepContent()}
</div>

// Para:
<ScrollArea className="max-h-[60vh]">
  <div className="space-y-4 px-6 py-4">
    {renderStepContent()}
  </div>
</ScrollArea>
```

#### 4. Cards Informativos (dentro de renderStepContent)
Padronizar todos os Cards para usar:
```tsx
// De:
<Card className="bg-green-500/5 border-green-500/20">
<Card className="bg-muted/50">
<Card className="bg-primary/5 border-primary/20">
<Card className="bg-amber-500/5 border-amber-500/20">

// Para (onde apropriado):
<Card className="bg-muted/30 border border-border/50">
```

#### 5. Step Indicator - Simplificar
O step indicator atual é mais elaborado que o padrão dos outros dialogs. Podemos simplificar ou remover para manter consistência visual.

### Resultado Visual Esperado

O dialog ficará visualmente consistente com:
- `InviteUserDialog` (criar usuário)
- `AdminEditDialog` (editar administrador)  
- Dialogs de workspace em `ClientsPage`

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/m365/TenantConnectionWizard.tsx` | Estrutura do Dialog, padding, ScrollArea, estilos de Cards |

---

## Checklist de Implementação

- [ ] Configurar Redirect URI no Azure Portal (manual)
- [ ] Ajustar DialogContent para `max-w-lg border-border/50`
- [ ] Adicionar ícone no DialogTitle
- [ ] Envolver conteúdo em ScrollArea
- [ ] Padronizar espaçamento com `px-6 py-4`
- [ ] Ajustar estilos dos Cards informativos
- [ ] Testar conexão OAuth após configuração do Azure

