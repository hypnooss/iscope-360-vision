
# Plano: Corrigir Validacao do --update sem Activation Code

## Problema

O script de instalacao exige `--activation-code` mesmo quando o usuario executa `--update`. Isso esta incorreto porque durante um update, o agent ja esta registrado e possui as credenciais salvas em `/etc/iscope-agent/agent.env`.

## Causa

Na linha 105-108 do script:

```bash
if [[ "$UNINSTALL" -eq 0 ]] && [[ -z "$ACTIVATION_CODE" ]]; then
  echo "Erro: --activation-code é obrigatório."
  exit 1
fi
```

A logica atual so permite pular a validacao do activation code para `--uninstall`, mas deveria tambem permitir para `--update`.

---

## Solucao

Alterar a condicao para permitir que `--update` tambem funcione sem activation code:

```bash
if [[ "$UNINSTALL" -eq 0 ]] && [[ "$UPDATE" -eq 0 ]] && [[ -z "$ACTIVATION_CODE" ]]; then
  echo "Erro: --activation-code é obrigatório para instalação nova."
  exit 1
fi
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/agent-install/index.ts` | Adicionar `UPDATE` na condicao de validacao |

---

## Codigo Atualizado

Linha 105-108:

```bash
# Antes
if [[ "$UNINSTALL" -eq 0 ]] && [[ -z "$ACTIVATION_CODE" ]]; then
  echo "Erro: --activation-code é obrigatório."
  exit 1
fi

# Depois
if [[ "$UNINSTALL" -eq 0 ]] && [[ "$UPDATE" -eq 0 ]] && [[ -z "$ACTIVATION_CODE" ]]; then
  echo "Erro: --activation-code é obrigatório para instalação nova."
  exit 1
fi
```

---

## Comportamento Esperado

| Comando | Resultado |
|---------|-----------|
| `--activation-code "XXXX"` | Instalacao nova (OK) |
| `--update` | Atualiza agent existente (OK) |
| `--uninstall` | Remove agent (OK) |
| (sem argumentos) | Erro: activation-code obrigatorio |
