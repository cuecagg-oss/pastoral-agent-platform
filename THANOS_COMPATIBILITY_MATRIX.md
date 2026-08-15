# Matriz de Compatibilidade — Ciclo THÁNOS

## Objetivo

Este documento congela os contratos externos do Assistente Pastoral antes da extração incremental do núcleo **THÁNOS Agent Hub**. O workspace Pastoral permanece o único workspace registrado neste ciclo. A extração interna não pode alterar rotas tRPC, formatos consumidos pelo cliente, limites de tenant, decisões de autorização, estados de confirmação, privacidade de voz ou campos de auditoria.

> A compatibilidade é avaliada pelo comportamento observável e pelos eventos auditáveis. Uma nova fachada interna só é aceita se o contrato do workspace Pastoral continuar equivalente.

## Invariantes de contexto

| Campo futuro | Fonte server-side | Semântica | Regra de compatibilidade |
|---|---|---|---|
| `workspaceKey` | Registro estático de workspace | Produto ou integração ativa | Neste ciclo será sempre `pastoral`; não é recebido do cliente. |
| `tenantId` | Membership da sessão autenticada | Escopo opaco de dados e autorização | Será derivado unidirecionalmente de `organizationId` como `org:<id>`; nenhuma consulta pode usar workspace ou domain como substituto. |
| `domain` | Definição de workspace/skill | Vocabulário e regras de negócio | Neste ciclo será `pastoral`, mas não seleciona tenant nem concede capabilities. |
| `organizationId` | `TenantContext` pastoral | Chave de repositório do domínio atual | Permanece no adaptador Pastoral; o core não a aceitará como alias de `tenantId`. |

Os três campos do `ThanosContext` serão distintos por tipo, construção e uso. Mesmo quando `workspaceKey` e `domain` tiverem o mesmo valor textual no primeiro ciclo, isso não autoriza comparação implícita, reutilização de campo ou entrada escolhida pelo cliente.

## Contratos de comportamento congelados

| Superfície | Comportamento obrigatório | Evidência de caracterização | Estratégia de rollback |
|---|---|---|---|
| Chat READ | O agente escolhe somente ferramenta declarada, filtra pelo tenant autenticado e retorna `tool`, `provider`, `model`, `requestId` e `confirmationStatus`. | `compatibility.contract.test.ts` e `agentCore.test.ts` | Reexportar o adaptador Pastoral para a implementação atual. |
| Pergunta por organizações | A resposta informa somente o escopo da organização atual e não conta nem revela outras igrejas. | `agentCore.test.ts` e `compatibility.contract.test.ts` | Manter classificador pastoral atual. |
| WRITE de acompanhamento | A preparação não grava dados; a confirmação exige role autorizada, chave idempotente e gera resultado `confirmed` ou `duplicate`. | `agentCore.test.ts` e `compatibility.contract.test.ts` | Manter `confirmFollowup` no adaptador Pastoral. |
| Catálogo de tools | Ferramenta desconhecida, desabilitada ou não autorizada é negada antes de consultar ou escrever dados. | `toolCatalog.test.ts`, `toolRegistry.test.ts` e `agentCore.test.ts` | Reusar o catálogo pastoral como fonte declarativa. |
| Configurações | Estado administrativo é sanitizado, com alteração restrita a `admin` e sempre limitada à organização autenticada. | `router.integration.test.ts`, `tenantGatewayConfig.test.ts` e `tenantToolConfig.test.ts` | Manter adaptadores sobre as tabelas de organização existentes. |
| Voz | A fala reconhecida é etapa interna; o histórico persiste apenas o marcador de voz e a resposta do agente. | `voiceGateway.test.ts`, `voiceUploadRoute.test.ts` e `agentCore.test.ts` | Preservar o prefixo e o adaptador de voz pastoral. |
| Dashboard | Métricas, tendências, pendências e insights usam exclusivamente o tenant autenticado; escopos e períodos são declarados. | `dashboardService.test.ts` e `router.integration.test.ts` | Manter o serviço de domínio no workspace Pastoral. |
| Auditoria | Eventos têm `requestId`, resultado, confirmação, ferramenta e provider/modelo quando aplicável, sem prompts, respostas brutas ou segredos. | `agentCore.test.ts`, `agentGateway.test.ts` e `router.integration.test.ts` | Preservar o repositório de auditoria atual através de um adaptador. |

## Critérios de equivalência da extração

| Dimensão | Condição de aprovação |
|---|---|
| Isolamento | Todas as consultas, ferramentas, configurações e eventos permanecem limitados ao mesmo `organizationId` que originou o contexto autenticado. |
| Autorização | A matriz atual de roles pastorais continua decidindo leitura, escrita, administração e Dashboard até o adaptador de capabilities estar equivalente. |
| Resposta | Os campos e estados usados pelo cliente permanecem estáveis; mudanças internas não exigem alteração de rota ou payload nesta etapa. |
| Confirmação | Nenhuma operação WRITE/SENSITIVE é planejada em múltiplas etapas; prévia, confirmação e idempotência permanecem explícitas. |
| Integrações | Hermes e n8n permanecem desativados por padrão, sanitizados e sem URL, token ou carga arbitrária expostos. |

## Evidência e reavaliação

Antes de cada extração, a suíte integral, a checagem de tipos e o build de produção devem passar. A cada checkpoint, esta matriz será revisada contra os adaptadores efetivamente usados; qualquer divergência exige teste de regressão e correção no mesmo ciclo antes do avanço de fase.

## Auditoria de implementação da Fase A

| Verificação | Resultado | Observação |
|---|---|---|
| Marcadores de trabalho incompleto | Aprovado | Não há `TODO`, `FIXME`, `NotImplemented` ou stub nos fontes TypeScript/TSX. |
| Exceções com `throw new Error` | Aprovado | As ocorrências em `db.ts` e `storage.ts` são validações de pré-condição e falhas de infraestrutura; não representam stubs. |
| Servidor de desenvolvimento | Aprovado após reinício | O erro histórico de resolução de `adminSettings` não se reproduziu depois de reiniciar o processo com o arquivo presente. |
| Chaves da auditoria administrativa | Corrigido e aprovado | A lista agora usa `eventKey` sanitizado e estável, derivado do identificador interno somente no servidor; a integração verifica unicidade sem expor o ID bruto. |
