# Dicionário de Métricas do Dashboard

Todas as métricas são calculadas no servidor a partir da organização derivada da sessão. Ausência de dados é exibida como estado explícito, não como valor inferido.

| Métrica | Definição operacional | Fonte | Estado sem base |
|---|---|---|---|
| Células realizadas | Reuniões concluídas de células dentro do período selecionado. | Reuniões e células do tenant. | “Sem reuniões concluídas no período”. |
| Células pendentes | Relatórios pendentes ou reuniões previstas sem conclusão, segundo regra exibida na tela. | Relatórios e reuniões do tenant. | Estado de pendência indisponível. |
| Presença total | Soma das presenças válidas em reuniões do período. | Presenças do tenant. | “Sem presenças registradas”. |
| Média por célula | Presença total dividida por reuniões/células com base válida. | Agregado de presença. | Não calcular quando o denominador for zero. |
| Visitantes | Visitantes cadastrados ou ativos conforme período e status documentados. | Visitantes do tenant. | “Sem visitantes no período”. |
| Pessoas cadastradas | Pessoas/membros ativos no tenant, conforme status definido pelo domínio. | Membros do tenant. | “Sem pessoas cadastradas”. |
| Líderes | Lideranças ativas no tenant. | Líderes do tenant. | “Sem lideranças cadastradas”. |
| Tendências | Variação entre períodos comparáveis com base suficiente nos dois lados. | Séries agregadas. | Omitir a tendência e explicar dados insuficientes. |
| Alertas | Regras objetivas, como visitante sem retorno ou relatório pendente. | Agregados e regras server-side. | Exibir estado vazio, sem gerar alerta fictício. |

## Camada inteligente

Insights não substituem métricas. Cada insight precisa conter título, prioridade, resumo, período, métricas de base e motivo de indisponibilidade quando aplicável. A primeira versão é somente leitura e usa apenas agregados sanitizados.
