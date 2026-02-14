

# Adicionar Exim como fonte de CVEs

## O que muda

Duas alteracoes simples seguindo o padrao existente:

### 1. Inserir nova source na tabela `cve_sources`

Inserir um registro com `module_code = 'external_domain'`, `source_type = 'nist_nvd_web'`, `source_label = 'Exim'` e `config = {"product_filter": "exim"}`, seguindo exatamente o padrao das fontes existentes (Nginx, OpenSSH, PHP, etc.).

### 2. Adicionar vendor no mapeamento `KNOWN_VENDORS`

No arquivo `supabase/functions/refresh-cve-cache/index.ts`, adicionar a entrada `exim: 'exim'` ao objeto `KNOWN_VENDORS` (linha 41-53). Isso permite que o sistema gere CPEs sinteticos corretos (`cpe:2.3:a:exim:exim:4.96.2:...`) quando o Nmap detecta o Exim nos servicos.

## Resultado

Na proxima sincronizacao (manual ou automatica), o sistema vai:
1. Buscar nos snapshots do Attack Surface qualquer servico contendo "exim"
2. Gerar CPEs sinteticos com a versao detectada (ex: 4.96.2)
3. Consultar o NIST NVD e cachear as CVEs encontradas
4. Correlacionar automaticamente com os assets nos cards do Analyzer

