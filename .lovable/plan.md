

# Atualizar versao do agente para 1.2.5

## Alteracao

### `python-agent/agent/version.py`

Alterar `__version__` de `"1.2.7"` para `"1.2.5"`.

```python
__version__ = "1.2.5"
```

Nenhuma outra alteracao necessaria. O `check-deps.sh` ja contem o fix do home directory e limpeza de cache.

