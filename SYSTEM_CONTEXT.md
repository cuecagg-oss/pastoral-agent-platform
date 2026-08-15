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

## Variáveis e configuração

Configuração de provedores é server-side. A futura configuração Hermes utilizará nomes de variáveis documentados, mas nunca valores expostos na aplicação: `HERMES_ENABLED`, `HERMES_BASE_URL`, `HERMES_API_KEY`, `HERMES_MODEL` e `HERMES_TIMEOUT_MS`.

Preferências administrativas por organização podem apenas restringir ou habilitar capacidades já allowlisted. Elas não podem criar providers, definir URLs, informar chaves, trocar modelos globais ou criar ferramentas arbitrárias.
