
# Plano: Corrigir Versão do Agent para Parar Loop de Atualização

## Problema Identificado

O agent está em loop infinito de atualização porque o arquivo `version.py` dentro do pacote ainda contém `__version__ = "1.0.0"` em vez de `1.1.1`.

**Sequência do loop:**
```
Agent inicia → reporta v1.0.0 → backend diz "atualize para 1.1.1" → 
instala → reinicia → reporta v1.0.0 → repete infinitamente
```

---

## Alterações Necessárias

### Arquivo: `python-agent/agent/version.py`

**De:**
```python
__version__ = "1.0.0"
```

**Para:**
```python
__version__ = "1.1.1"
```

---

## Passos Após Aprovação

1. Atualizar `version.py` para `1.1.1`
2. Você precisará recriar o pacote `iscope-agent-1.1.1.tar.gz` com o version.py corrigido
3. Fazer upload do novo pacote para o bucket `agent-releases`
4. Atualizar o checksum na configuração do admin

---

## Solução Imediata no Servidor (enquanto o pacote não é recriado)

Execute no servidor para parar o loop agora:

```bash
sudo systemctl stop iscope-agent
sudo sed -i 's/__version__ = "1.0.0"/__version__ = "1.1.1"/' /opt/iscope-agent/agent/version.py
sudo systemctl start iscope-agent
```
