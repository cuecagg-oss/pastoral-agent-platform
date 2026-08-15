# Roadmap de Evolução Segura

| Marco | Entrega | Ativação | Critério de saída |
|---|---|---|---|
| M1 | Contratos, configuração segura e Gateway em fallback. | Hermes desligado. | Texto e voz preservados com regressão aprovada. |
| M2 | Tool Registry declarativo e ferramentas piloto. | Apenas leitura e escrita confirmada. | Schemas, roles, tenant e auditoria testados. |
| M3 | Confirmação genérica e auditoria enriquecida. | Feature flag interna. | Idempotência, expiração e vínculo de usuário/conversa testados. |
| M4 | Hermes resiliente e n8n preparado. | Desativados por padrão. | Timeout, circuito, status sanitizado e allowlist cobertos. |
| M5 | Serviço e UI do Dashboard tradicional. | Ativo por tenant. | Métricas, vazios, tendências e mobile validados. |
| M6 | Camada inteligente e Configurações. | Insights somente leitura. | Fallback visual, permissões e auditoria aprovados. |
| M7 | Rollout controlado. | Hermes leitura por feature flag. | Métricas de erro/latência aceitáveis e rollback testado. |

## Rollback

O rollback operacional prioriza flags: `HERMES_ENABLED=false` e integrações externas desativadas retornam o comportamento ao Agent Core atual. Migrações devem ser exclusivamente aditivas; dados de histórico, voz e auditoria não são removidos durante a evolução.
