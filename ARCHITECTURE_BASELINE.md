# Baseline de Arquitetura

## Propósito e estado consolidado

Este documento descreve o estado verificável do Assistente Pastoral após a evolução de Gateway, catálogo declarativo, auditoria enriquecida, Dashboard gerencial, Configurações administrativas e o ciclo THÁNOS. Ele permanece a referência de compatibilidade: nenhuma entrega posterior pode reduzir o isolamento por organização, expor transcrições, segredos ou raciocínio interno, nem eliminar o caminho local quando provedores novos estiverem indisponíveis.

## Componentes atuais

| Camada | Estado atual | Garantia a preservar |
|---|---|---|
| Autenticação | Manus OAuth e cookie de sessão seguro de primeira parte. | A identidade do usuário só é derivada da sessão validada pelo servidor. |
| Multi-tenant | Organizações, memberships e `organizationId` em entidades pastorais. | O cliente nunca escolhe o tenant como fonte de autoridade. |
| Chat | Conversas persistentes, propriedade por usuário e histórico isolado. | Um segundo usuário, mesmo da mesma igreja, não lê conversas alheias. |
| Agent Gateway e Agent Core | Gateway por tenant, política, Model Router, fallback local e catálogo declarativo de ferramentas. | Nenhum modelo ganha acesso direto a SQL, repositórios ou rotas internas. |
| Voz | Áudio privado, transcrição interna, marcador de voz sem texto reconhecido e TTS do navegador. | Áudio e transcrição não entram em mensagens visíveis ou auditoria. |
| Auditoria | Eventos de ferramenta, voz e Hermes com `requestId`, resultado, confirmação e provedor/modelo, sem chain-of-thought. | Logs permanecem sanitizados e filtrados por tenant. |
| Dashboard | Métricas gerenciais, tendências, pendências com escopo declarado e insights determinísticos. | A tela continua a visão gerencial principal, não é substituída por chat ou IA generativa. |
| Configurações | Área administrativa por papel para status e controles allowlisted. | Nenhum segredo, URL sensível, tool ou workflow arbitrário é criado pela interface. |
| Núcleo THÁNOS | Contexto tipado, registros fechados, orquestração de leitura e portas sanitizadas. | `workspaceKey`, `tenantId` e `domain` são identidades distintas e não intercambiáveis. |
| Workspace Pastoral | Skill `pastoral-assistant`, adaptadores declarativos READ e fachada compatível. | A skill aceita apenas `chat`, exige `agent:read` e não permite `WRITE` ou `SENSITIVE`. |
| Piloto multi-step | Duas leituras pastorais fixas — células e presença — sob um único contexto. | Aceita somente 2–3 passos READ; falha operacional retorna fallback determinístico sem expor erro bruto. |

## Fluxos obrigatórios

```mermaid
flowchart LR
  U[Usuário autenticado] --> C[Contexto de sessão]
  C --> T[TenantContext]
  T --> G[Agent Gateway]
  G --> P[Policy Engine]
  P --> R[Tool Registry declarativo allowlisted]
  G --> F[Fallback Agent Core]
  R --> DB[(Banco isolado por tenant)]
  G --> A[Audit log sanitizado]
  T -. piloto interno .-> X[ThanosContext tipado]
  X --> W[Registros fechados de workspace e skill]
  W --> O[Orquestrador READ de uma ou múltiplas etapas]
  O --> A
```

O fluxo de voz utiliza a mesma cadeia depois da transcrição privada. Antes de o Gateway receber a intenção, o sistema persiste somente o marcador **Mensagem de voz**. O fluxo de texto persiste a mensagem do usuário conforme a política de conversa existente.

## Limites inegociáveis

| Limite | Regra |
|---|---|
| Banco e repositórios | Somente executores confiáveis podem acessá-los; modelos e conectores externos não recebem credenciais ou consultas livres. |
| Escritas | Exigem ferramenta cadastrada, schema validado, role autorizada, escopo derivado do servidor e confirmação quando definida pela matriz de risco. |
| Contexto de tenant | Sempre vem da membership autenticada; `organizationId` enviado pelo cliente, modelo ou provedor nunca é aceito como autoridade. |
| Segredos | Chaves, URLs sensíveis, variáveis de ambiente e objetos de erro brutos não são serializados para a UI, logs ou auditoria. |
| Automação externa | Começa desativada, allowlisted e sem URLs ou workflows arbitrários. |

## Critério de compatibilidade e rollback

Com Hermes desativado, indisponível ou inválido, o comportamento de texto e voz continua a usar o Agent Core local. O Dashboard tradicional continua disponível se a camada inteligente falhar. O n8n fica sem execução externa enquanto desativado. Toda migração é aditiva e reversível logicamente por configuração, com `AGENT_GATEWAY_PROVIDER=legacy`, `HERMES_ENABLED=false` e `N8N_ENABLED=false` como retorno operacional seguro.

## Limite de adoção do THÁNOS

O núcleo THÁNOS está estabilizado como piloto interno e caminho de compatibilidade do workspace Pastoral. A rota pública de conversa continua no `AgentGateway` e no `AgentCore` existentes; a troca dessa rota exige uma decisão explícita, métricas operacionais, teste de rollback e caracterização adicional. Portanto, o piloto não altera a semântica pública do chat, da confirmação de escrita ou do histórico persistente nesta versão.
