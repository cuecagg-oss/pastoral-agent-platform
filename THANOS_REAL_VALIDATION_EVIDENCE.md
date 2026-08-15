# Evidências da Validação Operacional Real do THÁNOS

## Estado inicial

Em **15 de agosto de 2026**, foi confirmada uma sessão autenticada no ambiente publicado do Assistente Pastoral. A organização ativa exibida pelo aplicativo é a organização de demonstração autorizada para esta validação. Nenhum identificador pessoal, allowlist ou segredo é registrado neste documento.

## Configuração temporária do piloto

O piloto foi limitado no servidor a uma única audiência autenticada, com versão sanitizada `thanos-live-validation-v1`, modo inicial habilitado e kill switch desligado. A configuração será revertida ao estado seguro após a coleta das evidências de rota THÁNOS e de rota legada.

## Observação de publicação

A primeira consulta autenticada no ambiente publicado foi persistida uma única vez e a auditoria registrou rota `legacy` com decisão `pilot_disabled`. Isso confirma que a instância publicada ainda não havia recarregado a configuração temporária; portanto, essa consulta **não** é tratada como evidência de rota THÁNOS. Será publicado um marco operacional para recarregar a configuração e a mesma prova será repetida com nova correlação.

Após o marco operacional, o chat publicado em `https://pastoralai-js2vazr4.manus.space/assistente` foi recarregado com a mesma sessão autenticada e está disponível para a repetição controlada.

A repetição da consulta elegível de três etapas foi exibida uma única vez no chat e retornou o conteúdo de relatório legado. A decisão de rota será confirmada exclusivamente pela auditoria persistida antes de qualquer conclusão.

Após a confirmação de publicação do marco operacional, a sessão autenticada permaneceu ativa e o campo do Assistente Pastoral ficou disponível para uma nova consulta controlada.

A nova consulta publicada foi exibida uma única vez e recebeu a mensagem sanitizada de que nem todas as consultas puderam ser concluídas. A classificação de rota, ferramentas e eventual fallback permanece pendente da auditoria persistida.

A auditoria persistida confirmou rota `thanos` elegível em modo `multi_read`, com três ferramentas declaradas e fallback determinístico parcial. O evento não acionou a rota legada, preservou `workspaceKey=pastoral`, `tenantId=org:1` e `domain=pastoral`, e registrou a falha sanitizada na primeira etapa. A resposta ao usuário permaneceu única e sem conteúdo interno de erro.

## Evidências pendentes

- Consulta pública elegível com resposta e histórico persistido uma única vez após o recarregamento publicado da configuração.
- Auditoria sanitizada com `requestId`, rota THÁNOS, ferramentas, duração por etapa e status.
- Ativação do kill switch, nova consulta pública e auditoria de rota legada.
- Restauração do estado seguro com o piloto desligado.
