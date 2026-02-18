
# Reposicionar Blocos Informativos na Tela de Instruções FortiGate

## Objetivo

Mover dois blocos de aviso/informação existentes para posições mais adequadas pedagogicamente, sem alterar o conteúdo de nenhum deles.

## Estrutura atual

```text
[Passo 1 — Criar REST API Admin]        (linhas 144–195)
[Passo 2 — Habilitar acesso via CLI]    (linhas 197–212)
[Passo 3 — Habilitar logs via REST API] (linhas 214–232)
[Bloco 🔒 Trusted Hosts]               (linhas 234–244)   ← fora de lugar
[Bloco ℹ️ super_admin_readonly]         (linhas 246–253)   ← fora de lugar
[Aviso SSL]                             (linhas 255–260)
```

## Estrutura desejada

```text
[Bloco ℹ️ super_admin_readonly]         ← antes do Passo 1
[Passo 1 — Criar REST API Admin]
[Bloco 🔒 Trusted Hosts]               ← entre Passo 1 e Passo 2
[Passo 2 — Habilitar acesso via CLI]
[Passo 3 — Habilitar logs via REST API]
[Aviso SSL]
```

## Mudanças técnicas no arquivo `src/pages/environment/AddFirewallPage.tsx`

Tudo ocorre dentro da função `FortiGateInstructions` (linhas 141–263). Serão feitas apenas movimentações de blocos JSX já existentes — nenhum conteúdo será alterado.

### Operação 1 — Remover bloco ℹ️ das linhas 246–253 e inserir antes da linha 144

O bloco:
```tsx
<div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
  <p className="text-sm text-blue-400 font-medium">ℹ️ Por que usar o perfil super_admin_readonly?</p>
  <ul className="text-xs text-blue-300/80 mt-1 space-y-1 list-disc list-inside">
    <li>Perfil nativo do FortiGate — não requer criação manual</li>
    <li>Acesso somente-leitura: não permite alterações de configuração</li>
    <li>Visibilidade completa para coleta de dados de compliance</li>
  </ul>
</div>
```
Passa a ser o **primeiro elemento** dentro de `<div className="space-y-4">`, antes do Passo 1.

### Operação 2 — Remover bloco 🔒 das linhas 234–244 e inserir após a linha 195 (fechamento do Passo 1)

O bloco:
```tsx
<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
  <p className="text-sm font-semibold text-destructive flex items-center gap-2">
    🔒 Segurança: Restrição por IP (Trusted Hosts)
  </p>
  <p className="text-xs text-destructive/80">
    Habilitar Trusted Hosts é essencial. Sem essa restrição...
  </p>
  <p className="text-xs text-destructive/80">
    Ao ativar Trusted Hosts e informar o IP...
  </p>
</div>
```
Passa a ficar **entre o fechamento do Passo 1 (linha 195) e o início do Passo 2 (linha 197)**.

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — apenas reposicionamento de blocos JSX dentro de `FortiGateInstructions`, sem alteração de conteúdo ou estilos.
