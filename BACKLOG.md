# Backlog de Evolução

## Entregas da versão atual

1. Agent Gateway com provider nulo e fallback preservado.
2. Registro declarativo de ferramentas e ferramentas piloto de leitura/escrita.
3. Confirmação genérica com idempotência e auditoria sanitizada.
4. Auditoria enriquecida com `requestId`, resultado, provedor/modelo e estado de confirmação, sem conteúdo sensível.
5. Hermes resiliente e opt-in, com retries, circuit breaker, fallback local e estado sanitizado; n8n governado e sem execução externa.
6. Dashboard tradicional normalizado, Camada inteligente determinística somente leitura e Configurações administrativas por papel.
7. Núcleo THÁNOS com contexto tipado, registros fechados e adaptador do primeiro workspace Pastoral.
8. Piloto multi-step de leitura com células, presença e relatórios, evidência composta, auditoria por etapa e fallback determinístico.
9. Roteamento público THÁNOS controlado por flag, kill switch, audiência server-side e intenções READ fechadas, com telemetria sanitizada e retorno legado sem duplicar histórico.

## Próximas decisões antes de qualquer ativação externa

| Item | Condição de entrada |
|---|---|
| Ativar Hermes em um tenant | Aprovar contrato HTTP, modelo, política de dados enviados, monitoramento de latência/erro e plano de rollback. |
| Ativar n8n | Aprovar workflow específico, destino, assinatura, payload, retentativa e responsável operacional. |
| Ampliar ferramentas de escrita | Revisar categoria, schema, papéis, confirmação, idempotência e cobertura de auditoria. |
| Insights generativos | Definir política de privacidade, escopo factual, explicabilidade e fallback determinístico. |
| Ampliar a audiência THÁNOS | Observar telemetria sanitizada, testar rollback e preservar a ativação explícita por tenant/usuário antes de ampliar o piloto. |
| Ampliar o piloto multi-step READ | Revisar tool allowlist, dependência entre etapas, limites de evidência, auditoria e comportamento de fallback; novas ferramentas exigem caracterização própria. |

## Fora do escopo desta versão

| Item | Motivo |
|---|---|
| Criação de ferramentas arbitrárias por administradores | Ampliaria a superfície de execução sem governança suficiente. |
| URLs, webhooks ou workflows arbitrários de n8n | Exigiria política de saída externa e aprovação adicional. |
| Hermes obrigatório para atendimento | Contraria o requisito de fallback seguro. |
| Escritas automáticas por insights | Exigiria confirmação e matriz de risco aprovada. |
| Exposição de chaves, prompts privados ou transcrições | Incompatível com os limites de segurança e privacidade. |
| Adoção global ou automática do THÁNOS no chat público | O piloto atual é restrito por audiência e intenção; expansão sem critérios de compatibilidade e rollback ampliaria o risco operacional. |
