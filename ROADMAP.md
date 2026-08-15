# Roadmap de Evolução Segura

| Marco | Entrega | Ativação | Critério de saída |
|---|---|---|---|
| M1 | Contratos, configuração segura e Gateway em fallback. | **Concluído**; Hermes desligado por padrão. | Texto e voz preservados com regressão aprovada. |
| M2 | Tool Registry declarativo e ferramentas piloto. | **Concluído**; leitura e escrita confirmada. | Schemas, roles, tenant e auditoria testados. |
| M3 | Confirmação genérica e auditoria enriquecida. | **Concluído**. | Idempotência, expiração, vínculo e rastreabilidade testados. |
| M4 | Hermes resiliente e n8n preparado. | **Concluído**; ambos desativados por padrão. | Timeout, circuito, status sanitizado, allowlist e fallback cobertos. |
| M5 | Serviço e UI do Dashboard tradicional. | **Concluído** por tenant. | Métricas, vazios, tendências, pendências e mobile validados. |
| M6 | Camada inteligente e Configurações. | **Concluído**; insights somente leitura. | Fallback visual, permissões, controles allowlisted e auditoria aprovados. |
| M7 | Ciclo THÁNOS: núcleo genérico, workspace/skill declarativos e piloto READ multi-step. | **Concluído**; interno e compatível. | Identidades segregadas, registros fechados, 2–3 passos READ, evidências compostas, auditoria e fallback testados. |
| M8 | Adoção controlada do THÁNOS pela rota pública de chat. | **Futuro**, requer aprovação arquitetural. | Caracterização do Gateway, métricas de compatibilidade, telemetria, rollback exercitado e nenhuma regressão em texto, voz ou escrita. |
| M9 | Rollout controlado de provedor externo. | **Futuro**, requer aprovação operacional. | Contrato Hermes validado, métricas de erro/latência aceitáveis e rollback exercitado. |

## Rollback

O rollback operacional prioriza `AGENT_GATEWAY_PROVIDER=legacy`, `HERMES_ENABLED=false` e `N8N_ENABLED=false`, retornando o comportamento ao Agent Core local e desativando saídas externas. Migrações são exclusivamente aditivas; dados de histórico, voz e auditoria não são removidos durante a evolução.
