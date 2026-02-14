
# Ajuste: Recuo interno dos topicos e espacamento entre blocos

## Alteracoes

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. Aumentar espacamento entre topicos
Linha 543: Trocar `space-y-5` por `space-y-8` no container expandido, aumentando a distancia vertical entre o fim de um bloco (ex: Portas Abertas) e o inicio do proximo (ex: Servicos e Tecnologias).

### 2. Adicionar recuo ao conteudo de cada topico
Em cada bloco (Portas Abertas, Servicos, Certificados TLS, Vulnerabilidades), o conteudo abaixo do titulo `h4` recebera um `pl-6` (24px) para criar separacao visual entre o titulo do topico e seus dados.

Isso afeta 4 blocos:
- **Portas Abertas** (linha ~551): o `div` com os badges de porta
- **Servicos e Tecnologias** (linha ~566): o `div` com os cards de servico
- **Certificados TLS** (linha ~613): o `div` com os cards de certificado
- **Vulnerabilidades**: o `div` com a lista de CVEs

Nenhuma borda ou fundo adicional sera incluido, apenas o recuo com `pl-6`.
