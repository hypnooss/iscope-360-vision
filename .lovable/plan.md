

# Diagnóstico: Erro de TLS no Agent após update

## Causa raiz

O erro é claro:

```
OSError: Could not find a suitable TLS CA certificate bundle, invalid path:
/opt/iscope-agent/venv/lib64/python3.9/site-packages/certifi/cacert.pem
```

O `requirements.txt` tem esta restrição:

```
certifi>=2024.2.2,<2026.0.0
```

**Estamos em fevereiro de 2026.** O pacote `certifi` segue o padrão de versionamento por data (ex: `2024.2.2`, `2025.12.6`, `2026.2.2`). A versão mais recente disponível no PyPI agora é provavelmente `2026.x.x`, que é **excluída** pelo upper bound `<2026.0.0`.

Quando o installer executou `pip install -r requirements.txt`, o pip tentou encontrar uma versão de `certifi` compatível com `>=2024.2.2,<2026.0.0`. Dependendo do estado do cache e do resolver, pode ter instalado uma versão parcial ou corrompida, resultando no diretório `certifi/` existir mas sem o arquivo `cacert.pem`.

## Correção

Remover o upper bound do `certifi` no `requirements.txt`:

| Arquivo | De | Para |
|---|---|---|
| `python-agent/requirements.txt` | `certifi>=2024.2.2,<2026.0.0` | `certifi>=2024.2.2` |

Isso permite que o pip instale a versão mais recente do `certifi` (2026.x.x), que inclui o bundle de certificados CA atualizado.

## Por que o agent ainda mostra v1.3.1

O installer `--update` baixou o pacote do bucket `agent-releases`. Se o pacote lá ainda é o da versão 1.3.1 (com o `requirements.txt` antigo contendo `<2026.0.0`), o agent vai continuar com esse problema. Após esta correção, será necessário gerar um novo `iscope-agent-1.3.2.tar.gz` e fazer upload ao bucket.

## Detalhes técnicos

- `certifi` usa versionamento baseado em data: `YYYY.M.D`
- O upper bound `<2026.0.0` fazia sentido quando foi definido (em 2024/2025) como proteção contra breaking changes
- Agora que estamos em 2026, esse bound impede a instalação de qualquer versão atual
- O `requests` depende de `certifi` para localizar o bundle de CA certificates — sem ele, nenhuma requisição HTTPS funciona

