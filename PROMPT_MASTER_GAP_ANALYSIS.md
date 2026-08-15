# Comparação com o Prompt Mestre — Assistente Pastoral de IA

**Data da revisão:** 15 de agosto de 2026  
**Base de evidências:** prompt mestre fornecido, código da aplicação, documentação técnica, testes e build executados nesta revisão.

## Veredito executivo

O projeto atual é um **MVP pastoral funcional e protegido**, não a plataforma integral descrita no prompt mestre. Os três primeiros MVPs previstos estão materialmente avançados: autenticação, contexto de tenant, chat, Agent Core, Tool Registry, Model Router configurável, dados de demonstração, voz, uma ação de escrita com confirmação e auditoria existem e são cobertos por regressão. A execução atual confirmou **33 testes em 12 arquivos**, todos aprovados.

No entanto, o prompt mestre descreve uma plataforma extensível de longo prazo, incluindo controle administrativo global, seleção de organização, RAG, telemetria de custo, integrações, WhatsApp, agente desenvolvedor, documentação arquitetural viva e estratégia de infraestrutura própria. Esses blocos ainda não existem ou estão apenas parcialmente preparados. Portanto, a classificação correta é: **MVP pastoral implementado; plataforma completa ainda em construção**.

> Não é adequado declarar a plataforma inteira como concluída. As validações de microfone, transcrição e reprodução de voz em dispositivo físico continuam pendentes, pois dependem da sessão, do navegador e do hardware do usuário.

## Matriz de aderência ao prompt mestre

| Pilar do prompt mestre | Evidência atual | Aderência | Lacuna relevante |
|---|---|---|---|
| Agent Core reutilizável | `AgentCore`, `PolicyEngine`, `ToolRegistry` e repositório pastoral separados. | Parcial forte | Ainda não há orquestrador de especialistas ou registro de múltiplos agentes. |
| Model Router multi-provedor | Adaptadores para OpenAI, Anthropic, Gemini e OpenRouter; fallback determinístico. | Parcial | Há apenas um provedor ativo por vez; faltam perfis principal/econômico/raciocínio/código, seleção por capacidade e fallback entre provedores. |
| Multi-tenancy | `organizationId` em entidades pastorais, filtros no repositório, contexto autenticado e teste de bloqueio cross-tenant. | Forte para o MVP | Não há seleção de organização para usuários com múltiplos vínculos nem escopo global de plataforma. |
| RBAC | Papéis `admin`, `pastor`, `supervisor` e `leader`; autorização de escrita no servidor. | Parcial | Faltam Super Admin, secretário, financeiro, operador, permissões granulares e gestão de papéis. |
| Ferramentas estruturadas | Cinco Read Tools autorizadas, uma Write Tool com prévia, confirmação, idempotência e audit log. | Forte para os casos cobertos | Faltam ferramentas para membros, discipulado, agenda, indicadores, financeiro, documentos e tarefas. |
| Voz | Upload multipart autenticado, limite, auditoria, transcrição via Voice Gateway, mesmo Agent Core e resposta falada do navegador. | Forte para MVP 2 | TTS não é intercambiável por provedor, não há preferência persistida texto/áudio/ambos e falta validação física final. |
| Histórico e memória | Conversas e mensagens são persistidas por usuário e tenant. | Parcial | Não existem categorias de memória organizacional, preferências, memória operacional ou RAG. |
| Observabilidade | Audit log inclui tenant, usuário, ação, agente, modelo, ferramenta e status; voz é auditada. | Parcial | Faltam duração, tokens, custo, versão de aplicação, painéis e métricas de produto. |
| Segurança | OAuth, sessão, validação servidor, isolamento, limites de áudio, URL assinada, logs sem cadeia de raciocínio; auditoria técnica sem vulnerabilidades críticas/altas/moderadas documentadas. | Forte para o MVP | Rate limiting geral, política de backup/restauração, CORS operacional, monitoramento contínuo e hardening de infraestrutura devem ser formalizados. |
| Documentação viva | `IMPLEMENTATION.md`, `AUDIT_REPORT.md`, `VERIFICATION_NOTES.md` e `todo.md`. | Parcial | Estão ausentes `ARCHITECTURE_BASELINE.md`, `ROADMAP.md`, `BACKLOG.md`, `SYSTEM_CONTEXT.md` e `DECISIONS.md`/ADRs requeridos pelo prompt mestre. |
| Infraestrutura Oracle e portabilidade | Aplicação publicada no ambiente gerenciado atual. | Não iniciado no escopo Oracle | Não há auditoria da Oracle, Docker Compose, reverse proxy próprio, runbook de deploy ou plano de migração. |
| RAG, WhatsApp, n8n, MCP e APIs externas | A arquitetura de ferramentas deixa espaço para evolução. | Futuro planejável | Nenhuma dessas integrações foi implementada, o que é coerente com evitar implementação prematura. |
| Agente Desenvolvedor | O ciclo de engenharia foi aplicado manualmente no projeto atual. | Não implementado como produto | Não há agente de desenvolvimento persistente, conectado a repositórios autorizados, com branch/commit/auditoria próprios. |

## Avaliação dos MVPs explícitos

| MVP do prompt mestre | Situação | Justificativa |
|---|---|---|
| MVP 1 — Assistente Pastoral de texto | **Implementado** | Usuário autentica, recebe contexto de organização, conversa, usa Agent Core, ferramentas autorizadas, Model Router/fallback e audit log. |
| MVP 2 — Voz | **Implementado, mas validação física pendente** | O áudio é autenticado, transcrito, encaminhado ao mesmo Agent Core e retorna com resposta textual/falada. Ainda é preciso comprovar o ciclo completo no celular do usuário. |
| MVP 3 — Write Tool | **Implementado** | O acompanhamento de visitante usa autorização, prévia, confirmação, idempotência e auditoria. |
| MVP 4 — Agente Desenvolvedor | **Não iniciado como funcionalidade da plataforma** | Não existe ainda agente que opere repositórios autorizados com contexto, branch, commit e documentação próprios. |

## A resposta: “Quantas igrejas temos?”

O agente respondeu:

> “Você está consultando a Igreja Demonstração A. Para preservar a privacidade entre organizações, eu não contabilizo nem revelo outras igrejas. Posso informar dados autorizados da igreja atual, como células, relatórios, presença, visitantes e líderes.”

### O que está correto

A resposta é **segura** no contexto atual. A conta autenticada opera no tenant `Igreja Demonstração A`, e a implementação impede que uma pergunta de contagem de igrejas caia no fallback de células ou leia dados de outras organizações. Isto evita que um usuário comum descubra quantas igrejas existem na plataforma ou receba dados agregados sem uma permissão explícita.

Esse comportamento é deliberado: a intenção “quantas igrejas/organizações” não aciona Read Tool; o Agent Core persiste apenas a resposta de escopo. O teste de regressão confirma que nenhuma ferramenta de leitura é chamada para essa pergunta.

### O que precisa melhorar

Segundo o prompt mestre, o agente **poderá consultar igrejas quando autorizado**. A implementação atual ainda não possui um papel de Super Admin nem uma ferramenta de leitura global com política específica. Por isso, a resposta é correta para o pastor da igreja, mas representa uma **lacuna de produto**, não a solução definitiva para a pergunta.

Além disso, a formulação pode ser mais útil. Ela deve explicar que a limitação decorre do **perfil e do escopo atual**, não sugerir que a plataforma jamais poderá responder à métrica global.

Uma resposta recomendada para o perfil atual é:

> “Você está no escopo da **Igreja Demonstração A**. Seu perfil não tem permissão para consultar a quantidade global de igrejas da plataforma. Posso informar os dados da sua igreja — por exemplo, células, relatórios, presença, visitantes e líderes. Se você quis dizer ‘quantas células temos’, posso consultar agora.”

Quando existirem Super Admin e uma ferramenta global auditada, a resposta poderá informar a quantidade de organizações somente a esse perfil, registrando a consulta em auditoria.

## Por que sua mensagem de voz não apareceu do seu lado no chat

Isso é uma consequência direta da alteração solicitada para não expor a transcrição. No fluxo atual, o áudio é armazenado de forma privada, transcrito no servidor e o texto reconhecido é enviado internamente ao mesmo Agent Core. A chamada usa `persistUserMessage: false`; portanto, a transcrição não vira uma bolha de mensagem e não é devolvida ao navegador. Somente a resposta final do assistente é persistida e exibida.

O ganho é privacidade e uma experiência centrada em voz. A desvantagem é que o histórico perde a indicação de que houve uma interação por áudio, o que reduz continuidade e auditabilidade da conversa para o próprio usuário.

O ajuste recomendado é criar uma mensagem de histórico do tipo **áudio**, sem texto transcrito, contendo somente metadados seguros como horário, duração, status de processamento e um rótulo “Mensagem de voz”. Assim, o usuário verá que enviou algo; a transcrição permanecerá privada; e o Agent Core continuará único para texto e voz.

## Prioridades recomendadas para o próximo ciclo

| Prioridade | Entrega | Motivo e critério de aceite |
|---|---|---|
| P0 | Validar sessão, microfone, transcrição e TTS em celular autenticado | Fecha as dependências reais do MVP de voz. O teste deve cobrir login, atualização da página, áudio, resposta e reprodução falada. |
| P0 | Registrar “mensagem de voz” no histórico sem transcrição | Resolve a ausência visual reportada sem reintroduzir exposição da transcrição. Deve preservar isolamento e permitir auditoria. |
| P1 | Implementar Super Admin, seleção de organização e Read Tool global auditada | Permite responder corretamente a “quantas igrejas temos?” somente para quem tiver autorização explícita. |
| P1 | Criar documentação viva e ADRs | Fecha a principal lacuna processual: baseline, roadmap, backlog, contexto do sistema e decisões reversíveis. |
| P1 | Evoluir o Model Router para perfis e fallback entre provedores | Aproxima a implementação do roteamento por capacidade/custo/contexto do prompt mestre. |
| P2 | Telemetria operacional | Incluir duração, tokens, custo estimado, versão e painel de observabilidade sem registrar raciocínio privado. |
| P2 | RAG e integrações | Priorizar somente após regras de documento, permissões, retenção e caso de uso definido. WhatsApp, n8n e MCP devem seguir a mesma camada de tools. |
| P3 | Agente Desenvolvedor e infraestrutura Oracle | Iniciar após a documentação e as políticas de autonomia/produção estarem formalizadas; exige projeto autorizado, branch, commit e auditoria. |

## Conclusão

O resultado atual demonstra que o **núcleo do Assistente Pastoral é real, testado e protegido**: não é apenas uma tela de chat. A resposta recebida sobre igrejas prova que a proteção de tenant foi priorizada, mas também revela que ainda falta o caminho autorizado de administração global e uma experiência de voz com registro visual de evento sem expor conteúdo.

O próximo incremento de maior valor é corrigir a ausência da mensagem de voz no histórico, concluir a validação física móvel e, em seguida, modelar o papel de Super Admin com a consulta global auditada. Isso preserva o que já funciona e aproxima o produto do prompt mestre sem antecipar RAG, WhatsApp ou infraestrutura complexa.

## Referências

[1]: /home/ubuntu/upload/Pasted_content_10.txt "Prompt mestre fornecido"
[2]: ./IMPLEMENTATION.md "Implementação do MVP"
[3]: ./AUDIT_REPORT.md "Relatório de auditoria técnica"
[4]: ./VERIFICATION_NOTES.md "Notas de verificação"
[5]: ./server/pastoral/agentCore.ts "Agent Core"
[6]: ./server/pastoral/voiceUploadRoute.ts "Rota de voz"
[7]: ./drizzle/schema.ts "Schema multi-tenant"
