

# Adicionar Opcao "Trocar Senha" no Menu do Usuario

## O que sera feito

Adicionar uma opcao "Trocar Senha" no menu dropdown inferior da sidebar (onde ja existe "Configuracoes" e "Sair"), abrindo um dialog modal para o usuario alterar sua senha.

## Mudancas

### 1. Criar componente `src/components/ChangePasswordDialog.tsx`

Dialog modal com formulario contendo:
- Campo "Nova Senha" (usando o componente `PasswordInput` ja existente)
- Campo "Confirmar Nova Senha"
- Validacao: senha minima de 6 caracteres e confirmacao deve ser igual
- Ao submeter, chama `supabase.auth.updateUser({ password })` 
- Exibe toast de sucesso ou erro
- Fecha automaticamente apos sucesso

### 2. Modificar `src/components/layout/AppLayout.tsx`

No menu dropdown do usuario (linhas 810-828):
- Importar o `ChangePasswordDialog`
- Adicionar state `changePasswordOpen`
- Adicionar item "Trocar Senha" com icone `Lock` entre "Configuracoes" e "Sair"
- Renderizar o dialog controlado pelo state

### Secao Tecnica

O Supabase Auth ja oferece `supabase.auth.updateUser({ password })` que atualiza a senha do usuario autenticado sem precisar da senha atual -- basta estar logado. Nenhuma edge function ou alteracao de banco e necessaria.

