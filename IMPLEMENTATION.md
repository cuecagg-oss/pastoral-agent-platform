# Assistente Pastoral de IA — estado da implementação

## Visão geral

O Assistente Pastoral de IA é uma aplicação multi-tenant para gestão de igrejas, com autenticação Manus OAuth, Dashboard gerencial, conversa persistente, entrada de voz privada e um agente governado no servidor. A identidade vem da sessão autenticada; a organização e o papel efetivo vêm da membership resolvida no servidor. Nenhuma requisição do cliente, modelo ou conector externo define o tenant com autoridade.

## Capacidades entregues

| Área | Implementação atual | Limite de segurança |
|---|---|---|
| Dashboard | Métricas de células, presença, média, visitantes, cadastros e lideranças; tendências, pendências e camada inteligente determinística. | Todos os agregados e escopos são calculados somente para a organização atual. |
| Assistente | `AgentGateway`, `AgentCore`, `PolicyEngine`, Model Router, Tool Registry e fallback determinístico. | Modelos não recebem SQL, repositórios ou acesso direto a ferramentas. |
| Ferramentas | Catálogo declarativo com categoria, papéis, confirmação, status e descrição; habilitação persistida por organização. | Administrações só alteram ferramentas conhecidas; não criam tools arbitrárias. |
| Escritas e auditoria | Prévia, confirmação idempotente, `requestId`, resultado, provedor/modelo e estado de confirmação. | Auditoria não armazena segredos, transcrições, prompts privados ou raciocínio interno. |
| Voz | Upload multipart autenticado, armazenamento privado, URL de leitura assinada, normalização `.m4a`, transcrição interna e TTS do navegador. | A fala reconhecida não aparece no histórico; apenas o marcador “Mensagem de voz” é persistido. |
| Configurações | Área administrativa com Geral, Usuários, Assistente IA, Hermes, Voz, Ferramentas, Integrações e Auditoria. | Leitura e alteração sensíveis são bloqueadas no servidor para papéis não administrativos. |

## Operação do Agent Gateway

O caminho local do `AgentCore` é sempre preservado. Hermes é opcional, desativado por padrão e recebe somente um prompt controlado com a pergunta e as evidências autorizadas pela ferramenta local. O cliente Hermes possui timeout, tentativas limitadas, circuit breaker por processo, resposta estruturada validada e retorno ao caminho local em timeout, indisponibilidade ou circuito aberto. O estado exibido para administradores é sanitizado e nunca inclui URL, chave, cabeçalho ou erro bruto.

O conector n8n permanece desativado por padrão. Nesta versão, ele aceita apenas identificadores de workflow previamente allowlisted; não aceita URL, webhook, destino ou carga arbitrária e não executa saída externa sem uma aprovação futura de contrato e política.

## Configuração server-side

Todas as variáveis são configuradas fora do repositório. Para a operação do Gateway, os controles documentados são `AGENT_GATEWAY_ENABLED`, `AGENT_GATEWAY_PROVIDER`, `AGENT_GATEWAY_MODEL`, `HERMES_ENABLED`, `HERMES_MODEL`, `HERMES_BASE_URL`, `HERMES_API_KEY`, `HERMES_TIMEOUT_MS`, `HERMES_RETRIES`, `HERMES_CIRCUIT_FAILURE_THRESHOLD`, `HERMES_CIRCUIT_COOLDOWN_MS`, `N8N_ENABLED` e `N8N_ALLOWED_WORKFLOWS`. Os valores e quaisquer segredos não são exibidos pela aplicação, pela auditoria ou por esta documentação.

Para manter o comportamento local, use o provider legado e mantenha `HERMES_ENABLED=false` e `N8N_ENABLED=false`. A voz continua usando o provider interno selecionado no servidor; sua disponibilidade final depende das permissões e recursos do navegador.

## Validação da versão

A validação final desta evolução concluiu migrações aditivas, regressão Vitest com **74 testes em 25 arquivos**, checagem TypeScript, build de produção e auditoria de dependências sem vulnerabilidades conhecidas. Também foram revisados fluxos de isolamento de tenant, autorizações administrativas, catálogo, confirmações idempotentes, auditoria estruturada, voz privada e as telas de Dashboard, Chat e Configurações em desktop e celular.

O projeto publicado está disponível em [pastoralai-js2vazr4.manus.space](https://pastoralai-js2vazr4.manus.space). A versão de referência desta etapa é o checkpoint `1ef5db45`.
