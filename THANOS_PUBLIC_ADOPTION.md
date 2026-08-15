# Adoção Controlada do THÁNOS no Chat Público

## Objetivo e estado

Este documento registra a adoção seletiva do núcleo THÁNOS no chat do workspace Pastoral. Ela não é uma troca global de runtime: o comportamento padrão permanece no `AgentGateway` e no `AgentCore`. O THÁNOS entra somente em consultas de leitura fechadas, sob uma configuração exclusivamente server-side e com reversão imediata.

> A autorização de tenant, usuário, capability e ferramenta continua sendo derivada no servidor. Nenhuma lista de audiência, segredo, URL interna, erro bruto ou raciocínio interno é enviado ao cliente ou à auditoria.

| Controle | Efeito operacional | Estado seguro padrão |
|---|---|---|
| `THANOS_PILOT_ENABLED` | Habilita a avaliação de elegibilidade. | `false` |
| `THANOS_PILOT_KILL_SWITCH` | Interrompe o THÁNOS antes de qualquer execução elegível. | `false` |
| `THANOS_PILOT_ORGANIZATION_IDS` | Restringe o piloto às organizações permitidas. | Vazio, portanto sem audiência. |
| `THANOS_PILOT_USER_IDS` | Restringe opcionalmente o piloto a usuários específicos. | Vazio, sem restrição adicional. |
| `THANOS_PILOT_VERSION` | Identifica a versão sanitizada no retorno e na telemetria. | `thanos-read-pilot-v1` |

## Decisão de rota

O `ThanosPilotRouter` é chamado pela mutation autenticada de mensagens. Ele recebe o `TenantContext` já derivado pela membership de sessão e mantém `conversationId` e `requestId` estáveis. Antes de executar, avalia flag, kill switch, audiência e intenção. Se qualquer condição falhar, delega diretamente ao caminho legado.

| Grupo | Mensagens admitidas pelo THÁNOS | Ferramentas permitidas |
|---|---|---|
| Leitura unitária | Perguntas sobre células, presença ou relatórios. | Uma ferramenta READ correspondente. |
| Resumo composto | Resumo de células e presença. | `consultar_celulas` + `consultar_presenca`. |
| Resumo composto ampliado | Resumo de células, presença e relatórios. | As três ferramentas READ, nessa ordem. |
| Sempre legado | Escritas, confirmações, voz, visitantes, líderes, consulta entre organizações e texto fora da allowlist. | Nenhuma ferramenta THÁNOS. |

O adaptador só constrói ferramentas presentes na skill Pastoral e no catálogo autorizado do tenant. O contexto THÁNOS mantém `workspaceKey`, `tenantId` e `domain` como identidades separadas. Cada etapa recebe o mesmo `TenantContext`; não há entrada do cliente para escolher tenant, etapa ou ferramenta.

## Persistência, telemetria e reversão

No caminho THÁNOS, o roteador separa três estágios. Primeiro, grava a mensagem de usuário. Se essa persistência falhar, o núcleo não é chamado e o legado recebe a responsabilidade normal de persistir a mensagem. Depois que a mensagem existe, uma falha de execução do THÁNOS delega ao legado com `persistUserMessage=false`; portanto, o fallback não cria uma segunda mensagem de usuário. Por fim, depois de uma resposta THÁNOS válida e persistida, uma falha de telemetria **não** aciona o legado nem altera a resposta já entregue.

O evento `thanos.route` contém apenas rota, decisão categórica, versão sanitizada, modo, quantidade/lista de ferramentas, presença de fallback, estágio categórico de falha e duração. As etapas continuam a registrar evento próprio com `requestId`, `workspaceKey`, `tenantId`, ferramenta, índice e duração nunca negativa. Se a telemetria final falhar, o sistema tenta registrar somente o evento sanitizado `thanos.route.telemetry_failed`; se esse registro também falhar, apenas escreve uma linha operacional sem dados do usuário. Nenhuma telemetria contém pergunta, evidência, allowlist, segredo, token, URL interna ou stack trace.

Para reversão operacional, definir `THANOS_PILOT_KILL_SWITCH=true` e reiniciar o processo aplica imediatamente o caminho legado às novas mensagens. Para retorno gradual, manter a flag desativada ou remover a audiência. Não há migração de banco, mudança de contrato de escrita ou alteração de histórico necessária para desativar o piloto.

## Evidência de validação

Foram aprovados testes determinísticos para configuração padrão, audiência por tenant/usuário, intenções fechadas, planos de uma, duas e três ferramentas, isolamento do contexto, auditoria por etapa, telemetria sanitizada, kill switch, fallback determinístico e fallback legado sem duplicação. A mutation pública foi exercitada com piloto desligado, público elegível, intenção/audiência não elegível, falha de execução e kill switch. Também foram reproduzidas a falha de telemetria após resposta THÁNOS válida — sem retorno ao legado — e a falha de relatórios na terceira etapa, com fallback parcial e tenant preservado. A regressão completa aprovou **107 testes em 34 arquivos**; `pnpm check`, build e auditoria de dependências de produção concluíram sem falhas.

O próximo alargamento deve continuar READ-only e só poderá ser adotado após caracterização, teste de compatibilidade, revisão de telemetria e verificação explícita de rollback. `WRITE`, `SENSITIVE`, voz e integrações externas não pertencem a este ciclo.
