# Registro de Decisões de Arquitetura

| ID | Decisão | Estado | Consequência |
|---|---|---|---|
| ADR-001 | Introduzir `AgentGateway` como porta única depois da autenticação e resolução do tenant. | Aprovada | Texto e voz recebem a mesma política, auditoria e fallback. |
| ADR-002 | Preservar o `AgentCore` atual como fallback local obrigatório. | Aprovada | Hermes não se torna dependência operacional do MVP. |
| ADR-003 | Aceitar planos de provider apenas quando passarem por schema, allowlist, policy e executor confiável. | Aprovada | Texto livre do provider nunca executa efeito. |
| ADR-004 | Manter Dashboard tradicional separado da Camada inteligente. | Aprovada | Métricas factuais continuam disponíveis mesmo sem IA. |
| ADR-005 | Persistir confirmações como entidade genérica e idempotente. | Aprovada | Escritas piloto compartilham TTL, estado e vínculo a usuário/conversa/tenant. |
| ADR-006 | Preparar Hermes e n8n com opt-in, diagnóstico sanitizado e desativação por padrão. | Aprovada | Não há saída externa arbitrária ou segredo exposto. |
| ADR-007 | Configurações administrativas serão declarativas e allowlisted. | Aprovada | Admin não cria tools, modelos, URLs ou workflows arbitrários. |
| ADR-008 | Auditoria registra decisão e resultado, não conteúdos privados ou raciocínio interno. | Aprovada | Operabilidade sem ampliar superfície de dados sensíveis. |

## Decisões pendentes

| Tema | Decisão necessária antes de ativar em produção |
|---|---|
| Contrato HTTP Hermes | Confirmar endpoint, método, headers permitidos e formato de resposta estruturada. |
| Papéis administrativos | Formalizar a semântica de `superadmin` e a matriz completa de permissões. |
| Tendências do Dashboard | Definir período padrão, timezone de negócio e base mínima para comparação. |
| n8n | Aprovar eventos, destino, assinatura e política de retentativa antes de habilitar qualquer workflow. |
