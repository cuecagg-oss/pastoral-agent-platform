# Backlog de Evolução

## Entregas da versão atual

1. Agent Gateway com provider nulo e fallback preservado.
2. Registro declarativo de ferramentas e ferramentas piloto de leitura/escrita.
3. Confirmação genérica com idempotência e auditoria sanitizada.
4. Hermes resiliente desativado por padrão e n8nConnector sem execução externa.
5. Dashboard tradicional normalizado, Camada inteligente somente leitura e Configurações administrativas por papel.

## Fora do escopo desta versão

| Item | Motivo |
|---|---|
| Criação de ferramentas arbitrárias por administradores | Ampliaria a superfície de execução sem governança suficiente. |
| URLs, webhooks ou workflows arbitrários de n8n | Exigiria política de saída externa e aprovação adicional. |
| Hermes obrigatório para atendimento | Contraria o requisito de fallback seguro. |
| Escritas automáticas por insights | Exigiria confirmação e matriz de risco aprovada. |
| Exposição de chaves, prompts privados ou transcrições | Incompatível com os limites de segurança e privacidade. |
