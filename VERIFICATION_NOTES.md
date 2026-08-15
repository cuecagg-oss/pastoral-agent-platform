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

O incidente inicial foi localizado antes da transcrição: a gravação era convertida em Base64 e enviada dentro de uma mutation tRPC/JSON. O registro de rede mostrou que esse request foi recusado com HTTP 403 pelo gateway, portanto o Agent Core e o provedor de voz não chegaram a processar o áudio.

A primeira troca para corpo binário bruto também foi bloqueada pelo gateway externo com HTTP 403 em HTML, antes de alcançar a aplicação. O cliente agora envia o `Blob` como `multipart/form-data` no campo `audio`; o servidor recebe o arquivo com limite de 16 MB e preserva validação de MIME, autenticação, limite por usuário e auditoria.

O smoke test externo multipart alcançou a aplicação e recebeu `401` JSON sem sessão, em vez do `403` do gateway. Isso comprova que o transporte passa pelo gateway e chega ao middleware de autenticação. A checagem TypeScript, os 23 testes automatizados e o build de produção também foram concluídos após a alteração. A confirmação restante exige uma sessão autenticada no celular.

## URL assinada para transcrição

Com o multipart aceito pelo gateway, os registros autenticados mostraram que o processamento ainda falhava depois do upload. A causa era a URL relativa privada retornada por `storagePut` (`/manus-storage/...`), que não é um endereço que o serviço de transcrição consegue buscar. O gateway agora solicita uma URL de leitura assinada pelo `storageGetSignedUrl` e somente essa URL é enviada ao provedor; o caminho interno e os bytes de áudio permanecem fora do log de auditoria.

O comportamento foi coberto por teste de unidade que confirma uma URL assinada no provedor. A checagem TypeScript e a regressão de 23 testes foram aprovadas. A validação final permanece dependente de uma gravação autenticada no navegador do usuário.
