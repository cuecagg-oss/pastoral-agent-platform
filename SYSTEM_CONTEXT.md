# Contexto Operacional e de Segurança

## Modelo de acesso

O sistema opera por organização. A sessão identifica o usuário; a membership ativa resolve o tenant e o papel efetivo. O servidor aplica a autorização antes de qualquer consulta, ferramenta, confirmação, configuração ou auditoria.

| Papel | Acesso operacional previsto |
|---|---|
| Usuário com membership | Dashboard e Assistente dentro da igreja atual, conforme a política de ferramentas. |
| Líder/Pastor | Consultas e ações pastorais permitidas pela matriz de risco do tenant. |
| Admin do tenant | Configurações permitidas da própria organização, status sanitizado e auditoria local. |
| Superadmin | Capacidade futura, explícita e verificada no servidor; nunca inferida pelo cliente. |

## Dados e privacidade

| Dado | Tratamento |
|---|---|
| Áudio enviado | Armazenamento privado de curta finalidade para transcrição autorizada. |
| Transcrição de áudio | Processamento interno; não aparece no histórico nem no audit log. |
| Mensagem de voz | Marcador estruturado no histórico, sem conteúdo reconhecido. |
| Métricas do Dashboard | Agregadas no servidor e sempre delimitadas ao tenant atual. |
| Insights | Dados agregados e sanitizados; sem nomes pessoais, áudio, chaves ou dados de outras organizações. |
| Auditoria | Metadados operacionais mínimos, sem segredos, transcrição ou chain-of-thought. |
| Contexto THÁNOS | `workspaceKey` identifica o workspace, `tenantId` a organização autenticada e `domain` o domínio de negócio. |
| Piloto multi-step | Todas as etapas READ usam o mesmo contexto autenticado; evidências aprovadas são compostas e falhas operacionais usam fallback determinístico. |

## Variáveis e configuração

Configuração de provedores é exclusivamente server-side. O Gateway usa `AGENT_GATEWAY_ENABLED`, `AGENT_GATEWAY_PROVIDER` e `AGENT_GATEWAY_MODEL`; Hermes usa `HERMES_ENABLED`, `HERMES_MODEL`, `HERMES_BASE_URL`, `HERMES_API_KEY`, `HERMES_TIMEOUT_MS`, `HERMES_RETRIES`, `HERMES_CIRCUIT_FAILURE_THRESHOLD` e `HERMES_CIRCUIT_COOLDOWN_MS`. O n8n é controlado por `N8N_ENABLED` e `N8N_ALLOWED_WORKFLOWS`. Estes nomes documentam controles, nunca valores.

Hermes e n8n iniciam desativados. Hermes só opera por caminho opt-in, timeout, retries limitados, circuit breaker e fallback local; n8n somente reconhece workflows allowlisted e não aceita URL, webhook ou carga arbitrária nesta versão.

Preferências administrativas por organização podem apenas restringir ou habilitar capacidades já allowlisted. Elas não podem criar providers, definir URLs, informar chaves, trocar modelos globais ou criar ferramentas arbitrárias.

O THÁNOS é um núcleo interno com registros fechados de workspace e skill. No workspace Pastoral, a skill de piloto opera apenas pelo canal `chat`, exige a capability `agent:read` e permite exclusivamente as leituras declaradas. A rota pública ainda é atendida pelo Agent Gateway compatível; nenhuma ativação do piloto altera confirmações de escrita, histórico ou isolamento já vigentes.
