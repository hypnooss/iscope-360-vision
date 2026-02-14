

# Fix: Erro de sintaxe no nmap_discovery.py

## Problema

O agent esta crashando na inicializacao (exit code 1) porque `nmap_discovery.py` tem um erro de sintaxe na linha 194: o metodo `cmd.extend([...])` fecha a lista com `]` mas nao fecha o parentese do `.extend(`.

```python
# Linha 194 - QUEBRADO
    '-oX', '-',
]           # falta o )
```

## Correcao

Linha 194 de `python-agent/agent/executors/nmap_discovery.py`:

```python
# Linha 194 - CORRIGIDO
    '-oX', '-',
])          # fecha lista E fecha extend()
```

## Causa raiz

Quando o `sudo` foi adicionado, o comando mudou de atribuicao direta (`cmd = [...]`) para `cmd.extend([...])`, mas o fechamento da lista nao foi atualizado para incluir o parentese.

## Impacto

- Agent volta a iniciar normalmente
- Correcao de 1 caractere (adicionar `)`)
- Nenhum outro arquivo afetado

