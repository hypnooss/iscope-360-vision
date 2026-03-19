
## O problema real desta vez

Não é a separação em 2 processos que falhou. Ela funcionou.

Fluxo que de fato aconteceu:
1. O Supervisor antigo recebeu `sup_update=True`
2. Ele escreveu `pending_supervisor_update.json`
3. O Worker leu esse arquivo, baixou o pacote e substituiu `/opt/iscope-agent/supervisor`
4. O Worker escreveu `supervisor_restart.flag`
5. O Supervisor antigo encerrou
6. O systemd tentou subir o Supervisor novo
7. O Supervisor novo morreu no boot com `status=1`

Ou seja: o update foi aplicado. O que falhou foi o boot da versão nova.

## Então qual é a falha de arquitetura

A falha está no contrato do update do Supervisor:

- o Worker considera o update “bem-sucedido” assim que copia a pasta `supervisor/`
- ele não valida se o Supervisor novo realmente consegue iniciar
- a validação atual é fraca demais: só checa `supervisor/__init__.py`
- depois disso ele já manda reiniciar

Na prática, qualquer pacote que:
- esteja incompleto,
- tenha import quebrado,
- tenha arquivo ausente,
- tenha dependência nova não instalada,
- ou esteja incompatível com o restante do diretório atual

passa como “update OK” e só explode no próximo boot.

## Por que parece que sempre precisa de 2 updates

Porque o primeiro update troca os arquivos, mas não prova que o Supervisor novo sobe.
Então vocês descobrem a falha só depois do restart.
Aí precisam publicar outro pacote corrigindo o pacote anterior.

## O ponto exato no código que permite isso

`python-agent/agent/supervisor_updater.py`

Hoje ele:
- baixa
- extrai
- acha `supervisor/__init__.py`
- faz backup
- substitui a pasta
- escreve restart flag

Ele não:
- valida `supervisor/main.py`
- valida arquivos críticos do módulo
- testa import/execução do `supervisor.main`
- instala dependências se o Supervisor passou a exigir algo novo
- confirma boot antes de marcar sucesso

## O que isso indica sobre “essa vez”

Com os logs que você mandou, o cenário mais provável é:

```text
cross-update funcionou
+
pacote novo do Supervisor ficou inválido para boot
ou incompatível com o ambiente atual
=
crash loop no systemd
```

Então o problema desta vez não é “o processo A não atualizou o B”.
O problema é:
“o Worker aplicou um pacote de Supervisor que não era bootável, e o fluxo atual não tem validação de boot antes do restart”.

## Plano de correção certo

### 1. Blindar o updater do Supervisor
Fortalecer `python-agent/agent/supervisor_updater.py` para validar:
- `supervisor/__init__.py`
- `supervisor/main.py`
- `supervisor/config.py`
- `supervisor/heartbeat.py`
- `supervisor/version.py`
- outros imports essenciais usados no boot

### 2. Fazer smoke test antes da troca
Antes de substituir a pasta ativa:
- extrair em staging
- executar um teste de import do `supervisor.main`
- falhou? aborta
- passou? aí sim troca

### 3. Não escrever restart flag sem prova mínima de integridade
A restart flag só deve ser escrita se:
- estrutura estiver válida
- smoke test passar

### 4. Melhorar rollback
Se a troca falhar:
- restaurar backup imediatamente

Se o processo novo cair no boot:
- ter fallback de inicialização para restaurar backup e subir de novo

### 5. Revisar o artefato publicado
Garantir que o pacote `iscope-supervisor-<version>.tar.gz` tenha exatamente o formato esperado pelo updater.
Hoje o código aceita pacote “bom demais no papel” e ruim na prática.

## Resultado esperado após a correção

```text
heartbeat -> pending file -> worker baixa pacote
-> valida estrutura real
-> smoke test de boot/import
-> replace
-> restart flag
-> systemd reinicia
-> supervisor sobe
```

Se o pacote estiver ruim:

```text
download -> validação falha
-> não troca a pasta ativa
-> não reinicia
-> versão atual continua viva
```

## Detalhe técnico importante

Tem mais um risco estrutural aqui:
o Supervisor novo roda como módulo `supervisor.main`, mas importa coisas de `agent.*` e `monitor.*`.
Então atualizar só `supervisor/` pode quebrar se a nova versão depender de mudanças fora dessa pasta.

Se essa release 1.1.2 alterou contrato com `agent/`, `monitor/`, `requirements.txt` ou bootstrap do projeto, o pacote vai copiar “certo” e subir “errado”.

Então a correção precisa cobrir os dois lados:
- validar melhor o pacote
- garantir que release de Supervisor não dependa silenciosamente de arquivos fora de `supervisor/`, ou então tratar isso explicitamente no empacotamento

## Implementação proposta
1. Reforçar validação do pacote no `agent/supervisor_updater.py`
2. Adicionar smoke test do `supervisor.main`
3. Adicionar logs detalhados do motivo da reprovação
4. Adicionar fallback/rollback no boot do serviço
5. Revisar pipeline/formato do pacote publicado do Supervisor
