

# Tornar o botao de nova consulta HIBP mais visivel

## Problema

Quando ja existem dados na secao de Credenciais Vazadas, o unico botao disponivel e o "Atualizar", que nao deixa claro que ele abre o modal de selecao de dominios para uma nova consulta HIBP. O usuario espera um botao explicito como "Consultar HIBP".

## Solucao

Adicionar um botao "Consultar HIBP" mais proeminente ao lado do botao "Atualizar" na area de acoes, quando ja existem dados.

## Alteracao

**Arquivo**: `src/components/external-domain/LeakedCredentialsSection.tsx`

Na secao de acoes (linhas 434-467), onde atualmente so aparece o campo de busca e o botao "Atualizar":

- Adicionar um botao **"Consultar HIBP"** (com icone Search) que abre o modal de selecao de dominios
- Manter o botao "Atualizar" como esta, para quem ja conhece o fluxo
- Ambos os botoes abrem o mesmo modal de selecao de dominios

O resultado visual sera:

```text
[Campo de busca]  [Consultar HIBP]  [Atualizar]  Ultima consulta: hoje
```

Isso torna obvio que o usuario pode iniciar uma nova consulta a qualquer momento.
