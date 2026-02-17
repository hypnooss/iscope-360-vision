

# Redesign da tela "Adicionar Dominio Externo"

## Problema

A tela atual parece um modal centralizado (card estreito no centro da pagina). Precisa parecer uma tela completa, seguindo o mesmo layout da tela de edicao (`ExternalDomainEditPage`).

## O que sera feito

Reescrever o layout de `src/pages/AddExternalDomainPage.tsx` para seguir exatamente o padrao da tela de edicao (print 2):

### Layout novo

1. **Breadcrumb** no topo: Ambiente > Novo Item > Dominio Externo
2. **Titulo + subtitulo** com botao de voltar (seta): "Adicionar Dominio Externo" / "Preencha as informacoes do novo dominio"
3. **Card "Informacoes do Dominio"** (full-width, com icone Globe no titulo):
   - Grid 2 colunas: Workspace (select ou input disabled) | Dominio Externo (input)
   - Agent (select, full-width abaixo)
   - Aviso de propriedade (Alert warning) dentro deste card
4. **Card "Agendamento de Analise"** (full-width, com icone Clock no titulo + descricao):
   - Frequencia (select full-width)
   - Separator + campos condicionais (Horario, Dia da Semana, Dia do Mes)
   - Texto descritivo da frequencia
5. **Botoes** no rodape (flex justify-end): Cancelar | Adicionar

### Detalhes tecnicos

- Remover o wrapper centralizado (`flex-1 flex items-center justify-center`) e o `max-w-lg`
- Usar `space-y-6` no container principal (mesmo padrao da tela de edicao)
- Cards full-width com `CardHeader` + `CardContent`
- Campos em grid responsivo (`grid-cols-1 md:grid-cols-2`)
- Manter toda a logica de dados (fetch clients, agents, submit) inalterada

