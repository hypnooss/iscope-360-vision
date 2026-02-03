

# Plano: Corrigir Comparação Case-Insensitive do Checksum

## Problema Identificado

```
Checksum mismatch: 
  esperado AD2CB0F92C9888DC6894AF557A3D3D3923C692CFF4EA8D58E66199FF8CBA8130
  recebido ad2cb0f92c9888dc6894af557a3d3d3923c692cff4ea8d58e66199ff8cba8130
```

O checksum no banco está em **UPPERCASE**, mas `hashlib.sha256().hexdigest()` retorna **lowercase**.

---

## Alteração Necessária

### Arquivo: `python-agent/agent/updater.py`

**Linha 134** - De:
```python
if actual == expected:
```

Para:
```python
if actual.lower() == expected.lower():
```

---

## Alternativa Rápida (sem deploy)

Você pode simplesmente atualizar o checksum no banco para lowercase:

```sql
UPDATE system_settings 
SET value = to_jsonb('ad2cb0f92c9888dc6894af557a3d3d3923c692cff4ea8d58e66199ff8cba8130'::text),
    updated_at = NOW()
WHERE key = 'agent_update_checksum';
```

---

## Recomendação

**Para resolver agora**: Execute o SQL acima para converter o checksum para lowercase.

**Para prevenir no futuro**: Aprovar este plano para adicionar comparação case-insensitive no código.

