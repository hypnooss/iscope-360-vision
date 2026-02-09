

# Fix: CRLF no check-deps.sh

## Problema

O script `check-deps.sh` está chegando ao servidor com line endings Windows (CRLF / `\r\n`), o que causa erro de sintaxe no bash e impede toda a verificação de componentes (PowerShell, módulos M365, certificados).

## Causa Raiz

O arquivo pode ser convertido para CRLF em dois momentos:
1. Durante o commit no Git (se `core.autocrlf` estiver ativo)
2. Durante o update automático do agent, quando o `updater.py` copia arquivos do pacote sem garantir line endings Unix

## Solução (3 pontos de correção)

### 1. `.gitattributes` - Prevenir CRLF no repositório

Criar arquivo `.gitattributes` na raiz do projeto para forçar LF em todos os scripts shell:

```text
*.sh text eol=lf
```

### 2. `updater.py` - Sanitizar após update

Após `_replace_files()`, adicionar chamada para converter line endings de todos os `.sh` no diretório de instalação:

```python
# Após _replace_files(extract_dir) na função check_and_update()
self._fix_shell_line_endings()
```

Nova função:
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

### 3. `agent-install/index.ts` - Sanitizar no instalador

Na função `write_check_deps_script()`, o script já é gerado via heredoc (que usa LF). Porém, como precaução, adicionar `dos2unix` ou `sed` ao final da função:

```bash
# Garantir line endings Unix
sed -i 's/\r$//' "$script_file"
```

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `.gitattributes` | Novo arquivo -- forçar `eol=lf` para `*.sh` |
| `python-agent/agent/updater.py` | Adicionar `_fix_shell_line_endings()` após substituição de arquivos |
| `supabase/functions/agent-install/index.ts` | Adicionar `sed -i 's/\r$//'` após escrever `check-deps.sh` |

## Ação Imediata no Servidor

Enquanto o fix não é deployado, o comando manual já fornecido resolve:

```bash
sed -i 's/\r$//' /opt/iscope-agent/check-deps.sh
sudo touch /var/lib/iscope-agent/check_components.flag
sudo systemctl restart iscope-agent
```

