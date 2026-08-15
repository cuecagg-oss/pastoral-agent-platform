# Evidências da Validação Operacional Real do THÁNOS

## Estado inicial

Em **15 de agosto de 2026**, foi confirmada uma sessão autenticada no ambiente publicado do Assistente Pastoral. A organização ativa exibida pelo aplicativo é uma organização de demonstração autorizada para esta validação. Nenhum identificador pessoal, allowlist ou segredo é registrado neste documento.

## Configuração temporária do piloto

O piloto foi limitado no servidor a uma única audiência autenticada, com versão sanitizada `thanos-live-validation-v1`, modo inicial habilitado e kill switch desligado. A configuração foi mantida exclusivamente no servidor e removida após a coleta das evidências de rota THÁNOS e de rota legada.

## Observação de publicação

A primeira consulta autenticada no ambiente publicado foi persistida uma única vez e a auditoria registrou rota `legacy` com decisão `pilot_disabled`. Isso confirmou que a instância publicada ainda não havia recarregado a configuração temporária; portanto, essa consulta não foi tratada como evidência de rota THÁNOS.

Após a recarga de publicação, a sessão autenticada permaneceu ativa e uma nova consulta elegível de três etapas foi executada. A auditoria persistida confirmou rota `thanos` em modo `multi_read`, com três ferramentas declaradas e fallback determinístico parcial. O evento não acionou a rota legada, preservou `workspaceKey=pastoral`, `tenantId=org:1` e `domain=pastoral`, e registrou a falha sanitizada na primeira etapa. A resposta ao usuário permaneceu única e sem conteúdo interno de erro.

## Prova real de rollback

Com o kill switch publicado, a mesma consulta controlada foi submetida pela sessão autenticada. A interface exibiu uma única resposta sanitizada. A auditoria persistida confirmou decisão `kill_switch`, rota `legacy`, resultado `legacy_kill_switch`, provedor `legacy` e `toolCount=0`. A execução não registrou ferramentas THÁNOS nem fallback adicional.

## Estado de restauração publicado

Foi solicitada a remoção da configuração temporária e a prova operacional isolada passou. Contudo, a consulta final publicada ainda registrou decisão `kill_switch`, rota `legacy` e resultado `legacy_kill_switch`. Portanto, a restauração do estado publicado **não está confirmada**: o kill switch permanece ativo na instância publicada e protege o ambiente ao forçar a rota legada.

## Evidências concluídas

- Consulta pública elegível, com resposta e histórico persistidos uma única vez após o recarregamento da configuração.
- Auditoria sanitizada com `requestId`, rota THÁNOS, ferramentas, duração por etapa e status.
- Ativação do kill switch, nova consulta pública e auditoria persistida de rota legada com decisão `kill_switch`.

## Pendência de restauração

- Aplicar e confirmar no ambiente publicado o estado padrão: piloto desativado, kill switch desativado e audiência removida. Até essa confirmação, nenhuma nova consulta de piloto será executada.
