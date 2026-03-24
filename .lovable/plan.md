## Plano: Priorizar Python do SCL via PATH e seleção por versão

### Status: ✅ Implementado

### O que foi feito

1. **`inject_scl_paths()`** — prepende `/opt/rh/rh-python3{8,9,11}/root/usr/bin` ao `$PATH`
2. **`choose_python()` refatorado** — testa cada candidato, lê a versão real via `sys.version_info`, ignora versões < 3.8, e seleciona a mais recente compatível
3. **Mínimo baixado para 3.8** — alinhado com `requirements.txt` e com o SCL disponível no CentOS 7
4. **`agent-fix`** — agora valida versão antes de recriar o venv (antes não validava)
5. **Logs melhorados** — mostra caminho + versão do Python selecionado, e motivo de rejeição dos incompatíveis

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-fix/index.ts` | `inject_scl_paths()` + `choose_python()` com validação de versão |
| `supabase/functions/agent-install/index.ts` | Idem + `require_python_min_version()` simplificado |
| `supabase/functions/super-agent-install/index.ts` | Idem |
