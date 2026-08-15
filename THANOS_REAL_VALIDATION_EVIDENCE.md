# Evidências da Validação Operacional Real do THÁNOS

## Estado inicial

Em **15 de agosto de 2026**, foi confirmada uma sessão autenticada no ambiente publicado do Assistente Pastoral. A organização ativa exibida pelo aplicativo é uma organização de demonstração autorizada para esta validação. Nenhum identificador pessoal, allowlist ou segredo é registrado neste documento.

## Configuração temporária do piloto

O piloto foi limitado no servidor a uma única audiência autenticada, com versão sanitizada `thanos-live-validation-v1`, modo inicial habilitado e kill switch desligado. A configuração foi mantida exclusivamente no servidor e removida após a coleta das evidências de rota THÁNOS e de rota legada.

## Observação de publicação

A primeira consulta autenticada no ambiente publicado foi persistida uma única vez e a auditoria registrou rota `legacy` com decisão `pilot_disabled`. Isso confirmou que a instância publicada ainda não havia recarregado a configuração temporária; portanto, essa consulta não foi tratada como evidência de rota THÁNOS.

Após a recarga de publicação, a sessão autenticada permaneceu ativa e uma nova consulta elegível de três etapas foi executada. A auditoria persistida confirmou rota `thanos` em modo `multi_read`, com `toolCount=3`, as ferramentas `consultar_celulas`, `consultar_presenca` e `consultar_relatorios`, provedor determinístico e `fallback=false`. O evento não acionou a rota legada; a resposta ao usuário permaneceu única e sem conteúdo interno de erro.

## Prova real de rollback

Com o kill switch publicado, a mesma consulta controlada foi submetida pela sessão autenticada. A interface exibiu uma única resposta sanitizada. A auditoria persistida confirmou decisão `kill_switch`, rota `legacy`, resultado `legacy_kill_switch`, provedor `legacy` e `toolCount=0`. A execução não registrou ferramentas THÁNOS nem fallback adicional.

## Estado de restauração publicado

Após a publicação que recarregou exclusivamente os valores já restaurados pelo usuário, uma nova consulta autenticada foi submetida no ambiente publicado. A auditoria persistida confirmou decisão `pilot_disabled`, rota `legacy`, resultado `legacy_pilot_disabled`, provedor `legacy` e `toolCount=0`. Assim, a instância publicada passou a refletir o estado padrão seguro: o piloto está desativado e não há audiência efetiva.

O parser de audiência foi validado para descartar o valor sentinela `0`. Dessa forma, os valores restaurados não habilitam organização ou usuário algum, sem exigir nova alteração de configuração.

## Evidências concluídas

- Consulta pública elegível de três etapas, com resposta e histórico persistidos uma única vez após o recarregamento da configuração.
- Auditoria sanitizada com `requestId`, rota THÁNOS, modo `multi_read`, `toolCount=3`, três ferramentas READ, duração e status sem fallback.
- Ativação do kill switch, nova consulta pública e auditoria persistida de rota legada com decisão `kill_switch`.
- Consulta autenticada final, após a restauração, com auditoria persistida de rota legada e decisão `pilot_disabled`.
- Parser de audiência validado para ignorar o sentinela `0`, mantendo a audiência efetivamente vazia.
