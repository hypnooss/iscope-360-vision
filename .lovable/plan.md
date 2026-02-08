

# Plano: Adicionar Botão de Exclusão de Certificado M365

## Objetivo

Adicionar um botão "Remover Certificado" no card de Certificado M365 na página de detalhes do Agent, permitindo que admins limpem os dados do certificado para forçar uma re-geração/re-upload.

## Motivação

- **Troubleshooting**: Quando há problemas com o certificado (formato incorreto, expirado, etc.)
- **Re-registro**: Forçar novo upload para Azure quando necessário
- **Limpeza**: Remover certificados de agents que não precisam mais de M365

## Alterações Necessárias

### 1. Adicionar estado para o dialog de confirmação

```typescript
const [deleteCertDialogOpen, setDeleteCertDialogOpen] = useState(false);
const [deletingCert, setDeletingCert] = useState(false);
```

### 2. Adicionar função para limpar o certificado

```typescript
const handleDeleteCertificate = async () => {
  if (!agent) return;

  setDeletingCert(true);
  try {
    const { error } = await supabase
      .from("agents")
      .update({
        certificate_thumbprint: null,
        certificate_public_key: null,
        azure_certificate_key_id: null,
      })
      .eq("id", agent.id);

    if (error) throw error;

    toast.success("Certificado removido! O agent gerará um novo certificado no próximo heartbeat.");
    setDeleteCertDialogOpen(false);
    refetch();
  } catch (error: any) {
    toast.error("Erro ao remover certificado: " + error.message);
  } finally {
    setDeletingCert(false);
  }
};
```

### 3. Adicionar botão no card de Certificado M365

Abaixo do botão "Baixar Certificado", adicionar:

```tsx
<Button 
  variant="outline" 
  size="sm" 
  className="text-destructive border-destructive/50 hover:bg-destructive/10"
  onClick={() => setDeleteCertDialogOpen(true)}
>
  <Trash2 className="w-4 h-4 mr-2" />
  Remover Certificado
</Button>
```

### 4. Adicionar dialog de confirmação

```tsx
<AlertDialog open={deleteCertDialogOpen} onOpenChange={setDeleteCertDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remover Certificado M365?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação irá remover o certificado M365 deste agent. O agent precisará 
        gerar um novo certificado e registrá-lo no Azure AD novamente.
        <br /><br />
        <strong>Nota:</strong> Se o agent tiver tenants vinculados, eles perderão 
        a capacidade de executar análises via PowerShell até que um novo 
        certificado seja registrado.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDeleteCertificate}
        disabled={deletingCert}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {deletingCert ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 mr-2" />
        )}
        Remover
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Layout do Card Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ Certificado M365                                         │
│ Certificado registrado no Azure AD e pronto para uso        │
├─────────────────────────────────────────────────────────────┤
│ Status do Registro              [✓ Registrado]              │
│                                                             │
│ Thumbprint (SHA-1)                                          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 47FF013BC99249965587DD92F7A7E9FAE7860331        [📋]│    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Azure Key ID                                                │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ abc123-def456-...                                    │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ [📥 Baixar Certificado]  [🗑️ Remover Certificado]          │
└─────────────────────────────────────────────────────────────┘
```

## Arquivo a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/AgentDetailPage.tsx` | EDIT | Adicionar botão e lógica de remoção do certificado |

## Segurança

- Apenas admins (isSuperAdmin ou isAdmin) têm acesso a esta página
- Dialog de confirmação para evitar cliques acidentais
- O certificado pode ser regenerado automaticamente pelo agent

