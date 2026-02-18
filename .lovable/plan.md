
# Detalhar Passo 1 — Criar REST API Admin com Subpassos

## Objetivo

Substituir o parágrafo único do Passo 1 por uma lista de subpassos numerados (a, b, c, d), refletindo exatamente o fluxo real dentro do FortiGate conforme o print compartilhado.

## Mudança no arquivo `src/pages/environment/AddFirewallPage.tsx`

### Bloco atual (linhas 144–152)

```tsx
<div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
  <h3>1 — Criar REST API Admin</h3>
  <p className="text-sm text-muted-foreground ml-8">
    Vá em System > Administrators, clique em Create New > REST API Admin.
    No campo Administrator Profile, selecione o perfil nativo super_admin_readonly...
    Anote o API Token gerado.
  </p>
</div>
```

### Bloco novo — lista de subpassos

```tsx
<div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
  <h3>1 — Criar REST API Admin</h3>
  <ol className="ml-8 space-y-2 text-sm text-muted-foreground list-none">

    <li className="flex items-start gap-2">
      <span className="font-mono text-primary text-xs mt-0.5">a</span>
      Vá em <code>System &gt; Administrators</code>
    </li>

    <li className="flex items-start gap-2">
      <span className="font-mono text-primary text-xs mt-0.5">b</span>
      Clique em <strong>Create New &gt; REST API Admin</strong>
    </li>

    <li className="flex items-start gap-2">
      <span className="font-mono text-primary text-xs mt-0.5">c</span>
      Preencha o formulário:
      <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
        <li>Username: <code>iscope360</code></li>
        <li>Administrator Profile: <code>super_admin_readonly</code></li>
        <li>PKI Group: <strong>desmarque</strong> (desabilitado)</li>
        <li>Clique em <strong>OK</strong></li>
      </ul>
    </li>

    <li className="flex items-start gap-2">
      <span className="font-mono text-primary text-xs mt-0.5">d</span>
      Anote o <strong>API Token</strong> gerado — ele será solicitado na próxima etapa
    </li>

  </ol>
</div>
```

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — linhas 144–152: substituir parágrafo único por lista de subpassos a→d dentro do bloco do Passo 1.
