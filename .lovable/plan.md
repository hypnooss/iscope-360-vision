

# Ajustar layout da pagina "Novo Item"

## Problema

O titulo, subtitulo e botao de voltar foram centralizados junto com os cards. O usuario quer que esses elementos fiquem no topo da pagina (logo abaixo do breadcrumb), e apenas os cards fiquem centralizados horizontalmente (com largura limitada).

## Mudanca em `src/pages/AddAssetPage.tsx`

Mover o bloco do titulo (botao voltar + h1 + subtitulo) para fora do container centralizado, mantendo-o logo abaixo do breadcrumb. Os cards permanecem centralizados horizontalmente com `max-w-lg mx-auto`, mas sem centralizar verticalmente com flex.

Layout resultante:
```text
[Breadcrumb: Ambiente > Novo Item]
[<- Novo Item                    ]
[   Selecione o tipo de ativo... ]
[                                ]
[      [Card Dominio Externo]    ]
[      [Card Firewall]          ]
[      [Card Microsoft 365]     ]
```

