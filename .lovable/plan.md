
# Plano: Corrigir Conflito de Variavel VERSION com /etc/os-release

## Problema

Ao executar `--update`, o script tenta baixar `iscope-agent-8.10.tar.gz` em vez de `iscope-agent-latest.tar.gz`.

A causa raiz: o script usa `source /etc/os-release` para detectar a versao do sistema operacional. Isso sobrescreve a variavel `VERSION` (que era "latest") com o valor de `VERSION` do arquivo `/etc/os-release` (ex: "8.10" no Oracle Linux 8.10).

## Causa Raiz

Linha 446-448:
```bash
source /etc/os-release
rhel_version="${VERSION_ID%%.*}"
```

O `source /etc/os-release` importa **todas** as variaveis do arquivo, incluindo `VERSION`, que colide com a variavel local do script.

## Solucao

Usar um subshell ou renomear a variavel do script para evitar colisao. A abordagem mais segura e renomear a variavel do script de `VERSION` para `AGENT_VERSION`.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/agent-install/index.ts` | Renomear `VERSION` para `AGENT_VERSION` em todo o script |

---

## Alteracoes Detalhadas

### 1. Declaracao da variavel (linha 24)

```bash
# Antes
VERSION="latest"

# Depois  
AGENT_VERSION="latest"
```

### 2. Parse de argumentos (linha 85)

```bash
# Antes
--version)
  VERSION="${2:-}"; shift 2 ;;

# Depois
--version)
  AGENT_VERSION="${2:-}"; shift 2 ;;
```

### 3. Funcao download_release (linhas 546-549)

```bash
# Antes
if [[ "$VERSION" == "latest" ]]; then
  file="iscope-agent-latest.tar.gz"
else
  file="iscope-agent-${VERSION}.tar.gz"
fi

# Depois
if [[ "$AGENT_VERSION" == "latest" ]]; then
  file="iscope-agent-latest.tar.gz"
else
  file="iscope-agent-${AGENT_VERSION}.tar.gz"
fi
```

---

## Por que essa abordagem

| Abordagem | Pros | Contras |
|-----------|------|---------|
| Renomear para AGENT_VERSION | Simples, claro, evita colisoes | Pequena mudanca em multiplos lugares |
| Usar subshell `(source ...)` | Nao muda nome da variavel | Mais complexo, facil de esquecer |
| Salvar/restaurar VERSION | Funciona | Feio e propenso a erros |

Renomear e a solucao mais limpa e idiomatica para scripts bash.

---

## Teste Esperado

Apos a correcao:

```bash
curl -fsSL .../agent-install | sudo bash -s -- --update
```

Devera baixar `iscope-agent-latest.tar.gz` corretamente.
