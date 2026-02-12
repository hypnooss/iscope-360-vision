
# Fix: Super Agent Install Edge Function - ReferenceError

## Problema

O erro `ReferenceError: version is not defined` ocorre porque o script bash do `check-deps` esta embutido dentro de um template literal do JavaScript (backticks). Variaveis bash como `${version}`, `${arch}`, `${tmp_dir}` e `${bin_path}` sao interpretadas pelo JS como expressoes de template, mas essas variaveis nao existem no contexto do JavaScript.

## Causa Raiz

Dentro da funcao `write_check_deps_script()` (linhas ~540-680), o heredoc `<<'CHECKDEPS'` eh corretamente delimitado para o bash nao interpolar, porem o conteudo inteiro ja esta dentro de um template literal JS. O JS processa `${version}` antes do bash sequer ver o script.

## Correcao

Escapar todas as referencias `${...}` dentro do bloco `check_and_install_httpx()` do heredoc embutido (linhas 618-656) para que o JS as trate como texto literal:

- `${version}` -> `\${version}`
- `${arch}` -> `\${arch}`  
- `${tmp_dir}` -> `\${tmp_dir}`
- `${bin_path}` -> `\${bin_path}`

Variaveis afetadas (linhas 618-655):
- Linha 618: `arch="$(uname -m)"` -> `arch="\$(uname -m)"`
- Linha 623: `$arch` -> `\$arch`
- Linha 628: `${version}` e `${arch}` -> `\${version}` e `\${arch}`
- Linha 630: `$(mktemp -d)` -> `\$(mktemp -d)`
- Linha 631: `${tmp_dir}` -> `\${tmp_dir}`
- Linha 633: `$tmp_dir` -> `\$tmp_dir`
- Linha 643: `${tmp_dir}` -> `\${tmp_dir}` e `$tmp_dir` -> `\$tmp_dir`
- Linha 645: `$tmp_dir` e `$bin_path` -> `\$tmp_dir` e `\$bin_path`
- Linha 646-649: `$bin_path` -> `\$bin_path`
- Linha 652: `$tmp_dir` -> `\$tmp_dir`
- Linha 655: `$tmp_dir` -> `\$tmp_dir`

## Arquivo a Editar

- `supabase/functions/super-agent-install/index.ts` — escapar variaveis bash no bloco check_and_install_httpx (linhas 611-657)

## Verificacao

Apos o fix, re-deploy da edge function e testar o curl novamente. O script deve ser servido corretamente como texto bash.
