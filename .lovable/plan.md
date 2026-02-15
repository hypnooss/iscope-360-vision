
# Melhorar Linha Conectora e Cor dos Links

## Duas mudancas no arquivo `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. Linha conectora entre secoes (quase invisivel)

A linha vertical entre "Portas Abertas", "Servicos & Tecnologias" e "Certificados TLS" usa `bg-primary/20` (20% de opacidade), tornando-a quase invisivel no tema escuro.

**Correcao**: Aumentar opacidade para `bg-primary/50` e largura para `w-1` (4px), tornando a linha claramente visivel. Linha 711.

### 2. Cor dos links em Servicos & Tecnologias

Os links (URLs como `http://177.200.196.228:80`) usam `text-primary` que e o tom de verde/teal da aplicacao. Mudar para tom de azul consistente com o icone de Servicos & Tecnologias.

**Correcao**: Na linha 641, trocar `text-primary` por `text-blue-400` nos links de web services.

### Resumo

| Local | Antes | Depois |
|-------|-------|--------|
| Linha conectora (L711) | `w-0.5 bg-primary/20` | `w-1 bg-primary/50` |
| Link URL web service (L641) | `text-primary` | `text-blue-400` |
