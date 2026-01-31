
## Diagnóstico (o que está acontecendo agora)
- O download/extract do tar.gz passou, e o instalador chegou em **“Configurando ambiente Python (venv)…”**.
- Ele falhou ao instalar dependências porque o servidor está usando **Python 3.6** (Oracle Linux 8 costuma vir com python36).
- As libs do `python-agent/requirements.txt` (ex.: `requests>=2.31.0`, `urllib3>=2.0.0`, `paramiko>=3.4.0`, `pysnmp>=6.0.0`) **não suportam Python 3.6** (requerem Python mais novo). Por isso o pip diz:
  - `ERROR: No matching distribution found for requests>=2.31.0`

## Decisão técnica recomendada (min version)
- Recomendo padronizar **Python >= 3.9** para o agent em ambientes RHEL-like (Oracle Linux/RHEL/Rocky/Alma).
  - Motivo: compatibilidade com libs atuais, menos dor com “No matching distribution”, mais segurança (Python 3.6 está EOL há anos).
  - Python 3.8 também é possível, mas 3.9 tende a ser mais disponível/estável no OL8 e reduz atrito.

## Ações imediatas (workaround para você destravar agora)
1) No servidor OL8, instalar Python 3.9 e venv:
   - Exemplo (pode variar conforme repos habilitados):
     - `sudo dnf install -y python39 python39-pip`
     - e/ou `sudo dnf install -y python39 python39-devel`
2) Re-rodar o instalador com `--update` (para recriar o venv):
   - `curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --update --activation-code "...."`

Observação: hoje o script usa `python3 -m venv ...`, então mesmo com python39 instalado, pode continuar pegando o python antigo se `python3` ainda apontar para 3.6. A correção “de verdade” abaixo resolve isso.

## Implementação (mudanças no código) — para corrigir de forma definitiva
### 1) Melhorar o instalador para garantir Python suportado (RHEL-like)
**Arquivo:** `supabase/functions/agent-install/index.ts`

**Mudanças planejadas:**
- No caminho `dnf/yum`, instalar explicitamente Python novo e ferramentas de venv:
  - Tentar instalar `python39` (fallback para `python38` se necessário).
- Detectar versão efetiva antes de criar venv:
  - Ex.: escolher automaticamente o executável disponível na ordem:
    1. `python3.11` (se existir)
    2. `python3.10`
    3. `python3.9`
    4. `python3.8`
    5. `python3`
  - Rodar `"$PYTHON_BIN" -c 'import sys; print(sys.version_info[:2])'` e validar `>= (3, 9)` (ou >= 3.8 se você preferir).
- Fazer o `setup_venv()` usar o binário escolhido:
  - `"$PYTHON_BIN" -m venv "$INSTALL_DIR/venv"`
- Se não conseguir cumprir a versão mínima:
  - Falhar com mensagem clara: “Python >= 3.9 é obrigatório” + comandos sugeridos para OL8.

**Resultado esperado:**
- Elimina o erro de “No matching distribution” causado por Python 3.6.

### 2) Ajustar a estratégia de empacotamento para reduzir dependência de internet/PyPI (venv “pré-empacotado”, do jeito certo)
Você selecionou “Venv pré-empacotado”. Na prática, embutir um venv pronto no tar.gz pode ser frágil (depende de arquitetura, glibc, paths, etc.). A alternativa robusta (e muito usada) é:

**“Offline wheels bundle”**:
- No processo de build do release, gerar uma pasta com **wheels** das dependências para Linux x86_64 e Python alvo (ex.: cp39):
  - `wheels/` com `*.whl`
- No tar.gz do agent, incluir:
  - `main.py`, `agent/**`, `requirements.txt` (ou `requirements.lock`)
  - `wheels/` (os wheels baixados)
- No instalador:
  - criar venv
  - instalar dependências sem acessar a internet:
    - `pip install --no-index --find-links "$INSTALL_DIR/wheels" -r "$INSTALL_DIR/requirements.txt"`

**Benefícios:**
- Instalação mais previsível e rápida
- Funciona em servidores sem acesso ao PyPI (ou com proxy restrito)
- Reduz variação de builds (“works on my machine”)

**O que isso exige operacionalmente:**
- Um “pipeline” de geração do tar.gz (na sua máquina ou CI) para:
  - baixar/buildar wheels compatíveis
  - empacotar tudo no `iscope-agent-latest.tar.gz`
- Não precisamos mexer em Supabase para isso; é só produzir o artefato e subir no bucket.

### 3) (Opcional) Ajustar `python-agent/requirements.txt` para compatibilidade (não recomendado como solução principal)
Alternativa seria “travar” versões antigas compatíveis com Python 3.6.
- Eu não recomendo, porque:
  - aumenta risco de segurança
  - aumenta o trabalho de manutenção
  - é um caminho de regressão

## Plano de testes (end-to-end)
1) No OL8, rodar:
   - `python3 --version`
   - `python3.9 --version` (se existir)
2) Executar o instalador:
   - `curl -fsSL .../agent-install | sudo bash -s -- --update --activation-code "..."`
3) Validar serviço:
   - `systemctl status iscope-agent --no-pager`
   - `journalctl -u iscope-agent -n 200 --no-pager`
4) Confirmar no painel que o agent fica **Online** (last_seen atualizando).

## Entregáveis (o que você verá mudar)
- Instalação não quebra mais por Python 3.6.
- Erros passam a ser explicativos (“instale python39”).
- Opção de instalação “sem internet” (se adotarmos o bundle de wheels).

## Observações importantes
- O erro de SSSD/sss_cache que apareceu anteriormente é um ruído do sistema, não está ligado ao pip/requests. Vamos manter o foco no Python/deps.
