

# Fix: CRLF no check-deps.sh (Plano Aprovado - Reimplementação)

O servidor já está funcionando após o fix manual. Agora precisamos aplicar as 3 correções permanentes no código.

## Alterações

### 1. Novo arquivo: `.gitattributes`
Forçar LF para todos os scripts shell no repositório Git:
```
*.sh text eol=lf
```

### 2. `python-agent/agent/updater.py`
Adicionar método `_fix_shell_line_endings()` e chamá-lo após `_replace_files()` (linha 88):

```python
# Após shutil.rmtree(extract_dir), adicionar:
self._fix_shell_line_endings()
```

Novo método na classe:
```python
def _fix_shell_line_endings(self):
    """Ensure all .sh files have Unix line endings (LF)."""
    for sh_file in self.install_dir.glob('*.sh'):
        try:
            content = sh_file.read_bytes()
            if b'\r\n' in content:
                content = content.replace(b'\r\n', b'\n')
                sh_file.write_bytes(content)
                self.logger.info(f"Line endings corrigidos: {sh_file.name}")
        except Exception as e:
            self.logger.warning(f"Erro ao corrigir line endings de {sh_file.name}: {e}")
```

### 3. `supabase/functions/agent-install/index.ts`
Após o `chown` do `check-deps.sh` (linha ~1131), adicionar:
```bash
sed -i 's/\r$//' "$script_file"
```

## Resumo

| Arquivo | Ação |
|---------|------|
| `.gitattributes` | Criar (forçar eol=lf para *.sh) |
| `python-agent/agent/updater.py` | Adicionar sanitização de line endings após update |
| `supabase/functions/agent-install/index.ts` | Adicionar sed para limpar CRLF após escrever check-deps.sh |

