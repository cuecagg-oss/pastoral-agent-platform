# Assistente Pastoral de IA — implementação do MVP

## O que está disponível

O MVP possui autenticação Manus OAuth, isolamento multi-tenant no servidor, dados de demonstração para duas igrejas, dashboard, chat com histórico persistente, ferramentas pastorais autorizadas, confirmação de acompanhamento de visitante, idempotência e auditoria. O sistema não envia SQL arbitrário ao modelo e não persiste chain-of-thought.

## Configuração de IA

Por padrão, o Agent Core usa uma resposta determinística segura, adequada para a demonstração sem credenciais externas. Para ativar um provedor, defina `AGENT_PROVIDER` como `openai`, `anthropic`, `gemini` ou `openrouter` e forneça a respectiva chave e, se necessário, modelo/base URL:

| Provedor | Variáveis |
|---|---|
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL` |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` |

As variáveis devem ser cadastradas no painel de segredos, nunca em arquivos versionados. Se um provedor não estiver configurado ou falhar, o Router retorna ao modo determinístico e mantém o fluxo do agente disponível.

## Voz e limites

O botão de microfone grava no navegador e envia o áudio ao gateway autenticado. `VOICE_PROVIDER=built-in` seleciona a transcrição integrada; valores ainda sem adaptador fazem fallback explícito para `built-in`, e falhas são auditadas sem registrar áudio no log. A leitura em voz alta usa a síntese de fala do navegador, mantendo a resposta textual como fonte canônica da conversa. A disponibilidade de microfone e vozes depende do dispositivo e do navegador.

## Verificação concluída

Foram aplicadas as migrações necessárias. A validação final abrangeu checagem TypeScript, build de produção e 14 testes Vitest, cobrindo política multi-tenant, Tool Registry, fluxo do agente, idempotência, auditoria, voz, consultas autenticadas de dashboard/conversa/mensagens e bloqueio cross-tenant.
