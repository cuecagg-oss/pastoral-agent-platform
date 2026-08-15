# Monitor sintético de resposta do chat

O monitor executa uma consulta READ representativa a cada quinze minutos para verificar se o Assistente Pastoral consegue retornar uma resposta válida. A rotina percorre organizações de forma isolada, utiliza a mesma cadeia de decisão do chat e valida que a ferramenta autorizada de células foi usada com conteúdo não vazio.

Cada verificação é executada com um repositório que impede a gravação de mensagens em conversas de usuários. O resultado persistido contém somente status, validade da resposta, duração, motivo sanitizado e horário. O histórico de conversas e o conteúdo de respostas não são armazenados pelo monitor.

O callback aceita apenas chamadas autenticadas como tarefa agendada e localiza a configuração pelo identificador confiável da tarefa. Ele é idempotente por organização e janela de execução, o que impede duplicidade quando a plataforma repete uma chamada.

O estado de saúde pode ser consultado por administradores pelo procedimento administrativo do chat. A tarefa recorrente pode ser observada, pausada, retomada ou inspecionada na área de tarefas agendadas do projeto.

## Evidência de ativação

A ativação inicial confirmou execuções saudáveis em duas organizações, sem execuções não saudáveis e sem mensagens sintéticas no histórico de usuários. A cadência permanente é de quinze minutos.
