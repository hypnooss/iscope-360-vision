

## Melhorias no Amass Executor para Enumeração Efetiva de Subdomínios

### Problema Identificado

O Amass está funcionando (50s de execução), mas retornou apenas 1 resultado - o registro MX do próprio domínio base. Isso indica que:

1. **Fontes limitadas**: O Amass v4.x sem configuração de API keys só usa fontes públicas muito limitadas
2. **Parser muito restritivo**: O parser atual aceita o domínio base como "subdomínio" válido
3. **Sem log de fontes consultadas**: Não sabemos quais fontes o Amass está realmente usando

### Solução Proposta

#### 1. Configurar Fontes Gratuitas no Amass

Adicionar suporte para um arquivo de configuração do Amass que habilita fontes gratuitas sem API key:

**Fontes gratuitas disponíveis:**
- crt.sh (Certificate Transparency - muito efetiva)
- Wayback Machine
- DNSDumpster
- Hackertarget
- BufferOver
- VirusTotal (limitado sem API)
- AlienVault OTX
- Robtex

#### 2. Melhorar o Comando Amass

Adicionar flags para maximizar resultados:
- `-src` - Mostra a fonte de cada resultado
- `-nocolor` - Melhor para parsing
- `-oA /tmp/amass-output` - Output estruturado

#### 3. Corrigir o Parser

- Excluir o domínio base da lista de subdomínios
- Capturar a fonte de cada descoberta
- Log completo de todas as linhas para debug

### Alterações Técnicas

**Arquivo:** `python-agent/agent/executors/amass.py`

**1. Atualizar o comando para incluir `-src` e melhor logging:**

```python
cmd = [
    amass_path,
    'enum',
    '-d', domain,
    '-timeout', str(timeout_minutes),
    '-nocolor',  # Melhor para parsing
    '-src',      # Mostra fonte de cada resultado
]
```

**2. Corrigir validação de subdomínio (excluir domínio base):**

```python
def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
    """Check if name is a valid subdomain of base_domain (excludes base domain itself)."""
    name = name.lstrip('*.').lower()
    base_domain = base_domain.lower()
    if not name:
        return False
    # IMPORTANTE: Excluir o próprio domínio base
    if name == base_domain:
        return False
    return name.endswith(f".{base_domain}")
```

**3. Melhorar parsing para capturar fontes por subdomínio:**

```python
# Parse format: "[source] subdomain (FQDN) --> ..."
source_subdomain_match = re.match(r'^\[([^\]]+)\]\s+([^\s]+)\s*\(FQDN\)', parts[0])
if source_subdomain_match:
    source = source_subdomain_match.group(1)
    name = source_subdomain_match.group(2).lower()
    sources_set.add(source)
    # Adicionar fonte ao subdomínio
    if name not in subdomains:
        subdomains[name] = {'subdomain': name, 'sources': [source], 'addresses': []}
    elif source not in subdomains[name]['sources']:
        subdomains[name]['sources'].append(source)
```

**4. Adicionar log de linhas não parseadas para debug:**

```python
# Log de linhas que não foram parseadas (para debug)
unparsed_lines = []
for line in output.splitlines():
    if line.strip() and not self._is_known_line(line):
        unparsed_lines.append(line[:100])

if unparsed_lines:
    self.logger.info(f"Unparsed lines: {unparsed_lines[:5]}")
```

### Teste Manual Recomendado

Para verificar o que o Amass pode descobrir com as fontes disponíveis, execute no servidor:

```bash
# Teste com flag -src para ver fontes
/usr/local/bin/amass enum -d taschibra.com.br -timeout 5 -passive -src -nocolor

# Teste com domínio mais conhecido (para validar setup)
/usr/local/bin/amass enum -d google.com -timeout 2 -passive -src -nocolor
```

Se mesmo com `-src` os resultados forem pobres, pode ser necessário:
1. Verificar conectividade com APIs externas
2. Configurar API keys no arquivo `~/.config/amass/config.yaml`

### Resultado Esperado

Após as alterações:
- Log mostrará as fontes consultadas (`[crt.sh]`, `[DNSDumpster]`, etc.)
- O domínio base não aparecerá como subdomínio
- Linhas não parseadas serão logadas para debug futuro

