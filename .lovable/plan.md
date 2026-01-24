

# Plano: Criar Arquivo de Indexação para Pasta python-agent

## Problema

A pasta `python-agent/` não está visível na interface do Lovable porque o sistema indexa principalmente arquivos web (TypeScript, JavaScript, etc.) e ignora arquivos Python puros.

## Solução

Criar um arquivo TypeScript simples na pasta `python-agent/` que servirá apenas para forçar a indexação da pasta, permitindo visualização de todos os arquivos.

## Arquivo a Criar

| Arquivo | Propósito |
|---------|-----------|
| `python-agent/_index.ts` | Arquivo vazio para forçar indexação da pasta |

## Conteúdo do Arquivo

```typescript
/**
 * Este arquivo existe apenas para forçar a indexação da pasta python-agent/
 * no sistema de arquivos do Lovable.
 * 
 * NÃO USAR EM PRODUÇÃO - arquivo auxiliar para desenvolvimento.
 * 
 * Para atualizar o agent no servidor, copie os arquivos .py desta pasta.
 */

export const PYTHON_AGENT_FILES = [
  'main.py',
  'requirements.txt',
  'agent/__init__.py',
  'agent/api_client.py',
  'agent/auth.py',
  'agent/config.py',
  'agent/heartbeat.py',
  'agent/logger.py',
  'agent/scheduler.py',
  'agent/state.py',
  'agent/tasks.py',
  'agent/executors/__init__.py',
  'agent/executors/base.py',
  'agent/executors/http_request.py',
  'agent/executors/snmp.py',
  'agent/executors/ssh.py',
] as const;
```

## Benefícios

1. **Visibilidade**: Pasta `python-agent/` aparecerá na árvore de arquivos
2. **Documentação**: Lista todos os arquivos Python do agent
3. **Sem impacto**: Não afeta o funcionamento do agent Python
4. **Fácil remoção**: Pode ser deletado quando não for mais necessário

## Resultado Esperado

Após criar o arquivo, a estrutura ficará visível:

```
python-agent/
├── _index.ts          ← Novo (força indexação)
├── main.py
├── requirements.txt
├── README.md
└── agent/
    ├── tasks.py       ← Arquivo com Fail-Fast
    ├── api_client.py
    ├── executors/
    └── ...
```

