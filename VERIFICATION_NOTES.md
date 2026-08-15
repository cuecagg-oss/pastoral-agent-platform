# Verificação de interface

## Experiência móvel — inspeção inicial

A navegação, o hero do dashboard, o CTA do Assistente Pastoral e o painel de voz foram renderizados em uma largura de 375 px. A hierarquia visual, a cópia e os alvos de interação permaneceram legíveis sem rolagem horizontal perceptível.

O dashboard e a conversa exibiram skeletons por mais tempo do que o esperado durante a captura. A próxima ação é confirmar os estados das consultas autenticadas no cliente e no servidor, corrigindo qualquer bloqueio de carregamento antes da entrega.

## Encerramento da validação

As consultas autenticadas foram verificadas por um teste de integração que chama o dashboard, cria ou recupera a conversa e lista as mensagens usando o contexto derivado da sessão no servidor. O banco retornou a associação da sessão de demonstração com a Igreja Demonstração A e confirmou a existência de duas organizações, cinco células e quatro visitantes na base de demonstração.

As capturas móveis em 375 px confirmaram cabeçalho compacto, hero, CTA, estados de carregamento informativos do chat e uma tela de acesso responsiva. O primeiro carregamento visível é uma transição normal após a sessão; os dados autenticados são verificados também em integração no backend.

O teste de isolamento agora cria um contexto autenticado da Igreja Demonstração B, comprova que seu dashboard é distinto e confirma que a tentativa de ler a conversa do tenant A retorna `FORBIDDEN`. Também foram adicionados estados recuperáveis de erro no dashboard e no chat, além de fallback explícito do VoiceProvider para a transcrição integrada.

Permanece necessário testar em um dispositivo físico a permissão de microfone, uma transcrição real, a confirmação de um acompanhamento e a síntese de voz do navegador; essa limitação é do hardware/sessão do usuário e não foi simulada como prova de funcionamento.

## Correção do envio de voz

O incidente reportado foi localizado antes da transcrição: a gravação era convertida em Base64 e enviada dentro de uma mutation tRPC/JSON. O registro de rede mostrou que esse request foi recusado com HTTP 403 pelo gateway, portanto o Agent Core e o provedor de voz não chegaram a processar o áudio.

O cliente agora envia os bytes do `Blob` para `/api/pastoral/voice` com `Content-Type` de áudio, e a rota autenticada monta o contexto do tenant, armazena o arquivo, chama a transcrição e audita o resultado. A rota foi verificada sem sessão, retornando 401; a checagem de tipos e 16 testes automatizados foram concluídos com êxito. Resta apenas a confirmação prática com uma sessão autenticada em dispositivo móvel.
