# Evidências da Validação Operacional Real do THÁNOS

## Estado inicial

Em **15 de agosto de 2026**, foi confirmada uma sessão autenticada no ambiente publicado do Assistente Pastoral. A organização ativa exibida pelo aplicativo é a organização de demonstração autorizada para esta validação. Nenhum identificador pessoal, allowlist ou segredo é registrado neste documento.

## Configuração temporária do piloto

O piloto foi limitado no servidor a uma única audiência autenticada, com versão sanitizada `thanos-live-validation-v1`, modo inicial habilitado e kill switch desligado. A configuração será revertida ao estado seguro após a coleta das evidências de rota THÁNOS e de rota legada.

## Observação de publicação

A primeira consulta autenticada no ambiente publicado foi persistida uma única vez e a auditoria registrou rota `legacy` com decisão `pilot_disabled`. Isso confirma que a instância publicada ainda não havia recarregado a configuração temporária; portanto, essa consulta **não** é tratada como evidência de rota THÁNOS. Será publicado um marco operacional para recarregar a configuração e a mesma prova será repetida com nova correlação.

## Evidências pendentes

- Consulta pública elegível com resposta e histórico persistido uma única vez após o recarregamento publicado da configuração.
- Auditoria sanitizada com `requestId`, rota THÁNOS, ferramentas, duração por etapa e status.
- Ativação do kill switch, nova consulta pública e auditoria de rota legada.
- Restauração do estado seguro com o piloto desligado.
