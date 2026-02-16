

# Desativar Seção de Credenciais Vazadas

## O que será feito

Remover a seção "Credenciais Vazadas (DeHashed)" da página do Analyzer de domínio externo, já que nenhuma API viável está disponível no momento.

## Alterações

1. **Remover a importação e uso do `LeakedCredentialsSection`** no arquivo que monta a página do Analyzer (provavelmente `AttackSurfaceAnalyzerPage.tsx` ou similar) -- comentar ou remover o componente da renderização.

2. **Manter os arquivos existentes** (`LeakedCredentialsSection.tsx`, `dehashed-search/index.ts`, tabela `dehashed_cache`) intactos no código para facilitar uma reativação futura com outra API.

Resultado: a seção simplesmente não aparece mais na interface.

