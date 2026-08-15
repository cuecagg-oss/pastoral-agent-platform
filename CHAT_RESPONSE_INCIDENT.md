# Incidente de resposta do chat — 15 de agosto de 2026

## Evidência observada

Uma sessão autenticada no ambiente publicado exibiu o histórico do Assistente Pastoral e respostas normais anteriores. A auditoria sanitizada identificou dois envios recentes persistidos somente como mensagens de usuário, acompanhados por negações `tool_disabled` para `consultar_celulas`; não houve mensagem de assistente correspondente.

## Causa e correção

O catálogo específico da organização continha `consultar_celulas` com `enabled=0`, remanescente de uma validação operacional. A configuração foi restaurada para `enabled=1`. O Agent Core também passou a persistir e retornar uma mensagem segura de indisponibilidade quando qualquer ferramenta READ estiver desabilitada, em vez de encerrar a conversa sem resposta.

## Validação publicada

Uma nova consulta READ foi enviada pelo chat publicado após a correção. A interface exibiu a resposta com dados autorizados da organização. A auditoria sanitizada registrou `agent.respond` com `response_generated`, `agent_gateway.respond` com `gateway_response` e a decisão `legacy_pilot_disabled`, todos com status de sucesso. Isso confirma envio, execução, persistência e apresentação da resposta no ambiente publicado.
