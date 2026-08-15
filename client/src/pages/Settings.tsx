import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Bot, Cable, CheckCircle2, ChevronRight, ClipboardList, Mic, Radio, RefreshCw, Settings2, ShieldAlert, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  const positive = ["online", "configured", "connected", "success", "enabled"].includes(status);
  const warning = ["unknown", "unconfigured", "disabled", "open", "unavailable"].includes(status);
  return <Badge variant="outline" className={positive ? "border-[#9ac9a6] bg-[#eff8f0] text-[#24714d]" : warning ? "border-[#e7cb92] bg-[#fff8e8] text-[#8b5d13]" : "border-[#e7c4be] bg-[#fff6f4] text-[#9b3c2b]"}>{status}</Badge>;
}

function SettingsLoading() {
  return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-64 rounded-2xl md:col-span-2" /></div>;
}

export function SettingsAccessDeniedCard() {
  return <Card className="border-[#e8d39f] bg-[#fffaf0]"><CardContent className="p-6"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff0cf] text-[#9a6712]"><ShieldAlert className="size-5" /></div><h2 className="mt-4 text-xl font-semibold text-[#5f451b]">Acesso administrativo necessário</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d5c3d]">Sua função atual não permite consultar ou alterar as configurações sensíveis desta organização. Fale com uma pessoa administradora caso precise de acesso.</p></CardContent></Card>;
}

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const access = trpc.pastoral.settingsAccess.useQuery(undefined, { enabled: Boolean(user && isAuthenticated) });
  const enabled = access.data?.allowed === true;
  const overview = trpc.pastoral.settingsOverview.useQuery(undefined, { enabled });
  const gateway = trpc.pastoral.agentSettings.useQuery(undefined, { enabled });
  const catalog = trpc.pastoral.toolCatalog.useQuery(undefined, { enabled });
  const integrations = trpc.pastoral.integrationStatus.useQuery(undefined, { enabled });
  const [agentDraft, setAgentDraft] = useState<{ enabled: boolean; provider: "legacy" | "hermes"; model: string } | null>(null);

  useEffect(() => {
    if (gateway.data && !agentDraft) {
      setAgentDraft({ enabled: gateway.data.status === "online", provider: gateway.data.provider, model: gateway.data.model });
    }
  }, [gateway.data, agentDraft]);

  const updateAgent = trpc.pastoral.updateAgentSettings.useMutation({
    onSuccess: async () => {
      toast.success("Preferências do assistente atualizadas.");
      await Promise.all([utils.pastoral.agentSettings.invalidate(), utils.pastoral.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message || "Não foi possível atualizar o assistente."),
  });

  const updateTool = trpc.pastoral.updateToolStatus.useMutation({
    onMutate: async input => {
      await utils.pastoral.toolCatalog.cancel();
      const previous = utils.pastoral.toolCatalog.getData();
      utils.pastoral.toolCatalog.setData(undefined, current => current?.map(tool => tool.name === input.name ? { ...tool, enabled: input.enabled } : tool));
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.pastoral.toolCatalog.setData(undefined, context?.previous);
      toast.error(error.message || "Não foi possível alterar a ferramenta.");
    },
    onSuccess: data => {
      utils.pastoral.toolCatalog.setData(undefined, data);
      toast.success("Disponibilidade da ferramenta atualizada.");
    },
    onSettled: () => utils.pastoral.toolCatalog.invalidate(),
  });

  const testHermes = trpc.pastoral.testHermes.useMutation({
    onSuccess: async status => {
      toast[status.connection === "connected" ? "success" : "error"](status.connection === "connected" ? "Conexão Hermes verificada." : "Hermes não está disponível no momento.");
      await Promise.all([utils.pastoral.integrationStatus.invalidate(), utils.pastoral.agentSettings.invalidate()]);
    },
    onError: error => toast.error(error.message || "O teste Hermes não foi concluído."),
  });

  const pageHeader = <section className="relative overflow-hidden rounded-3xl bg-[#f4efe2] px-6 py-7 md:px-8"><div className="absolute -right-5 -top-7 size-32 rounded-full border-[18px] border-[#d9c66e]/50" /><div className="relative max-w-3xl"><div className="mb-3 flex items-center gap-2 text-[#56705e]"><Settings2 className="size-5" /><span className="text-sm font-semibold">Administração protegida</span></div><h1 className="font-['Fraunces'] text-3xl font-semibold tracking-tight text-[#173b34] md:text-4xl">Configurações da organização</h1><p className="mt-2 text-sm leading-6 text-[#516259]">Consulte serviços, permissões e auditoria; apenas mudanças já declaradas e auditadas estão disponíveis nesta fase.</p></div></section>;

  return <DashboardLayout><div className="mx-auto flex max-w-6xl flex-col gap-6 pb-8">{pageHeader}
    {access.isLoading ? <SettingsLoading /> : access.isError ? <Card className="border-[#eccdc5] bg-[#fff9f7]"><CardContent className="flex items-center gap-3 p-6 text-[#8d3423]"><AlertCircle className="size-5" /><span>Não foi possível verificar suas permissões administrativas.</span></CardContent></Card> : !enabled ? <SettingsAccessDeniedCard /> : overview.isLoading || gateway.isLoading || catalog.isLoading || integrations.isLoading ? <SettingsLoading /> : overview.isError || gateway.isError || catalog.isError || integrations.isError ? <Card className="border-[#eccdc5] bg-[#fff9f7]"><CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#8d3423]">Não foi possível carregar todas as configurações.</p><p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p></div><Button variant="outline" onClick={() => void Promise.all([overview.refetch(), gateway.refetch(), catalog.refetch(), integrations.refetch()])}>Tentar novamente</Button></CardContent></Card> : <Tabs defaultValue="general" className="w-full"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-[#edf0ea] p-1.5"><TabsTrigger value="general"><Settings2 className="mr-2 size-4" />Geral</TabsTrigger><TabsTrigger value="users"><UsersRound className="mr-2 size-4" />Usuários</TabsTrigger><TabsTrigger value="assistant"><Bot className="mr-2 size-4" />Assistente IA</TabsTrigger><TabsTrigger value="hermes"><Radio className="mr-2 size-4" />Hermes</TabsTrigger><TabsTrigger value="voice"><Mic className="mr-2 size-4" />Voz</TabsTrigger><TabsTrigger value="tools"><Wrench className="mr-2 size-4" />Ferramentas</TabsTrigger><TabsTrigger value="integrations"><Cable className="mr-2 size-4" />Integrações</TabsTrigger><TabsTrigger value="audit"><ClipboardList className="mr-2 size-4" />Auditoria</TabsTrigger></TabsList>
      <TabsContent value="general" className="mt-5"><div className="grid gap-4 md:grid-cols-2"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Organização</CardTitle><CardDescription>Dados disponíveis na sessão multi-tenant autenticada.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome</p><p className="mt-1 font-medium text-[#173b34]">{overview.data?.organization.name}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seu papel</p><div className="mt-1"><Badge className="bg-[#173b34] capitalize text-white">{overview.data?.organization.role}</Badge></div></div></CardContent></Card><Card className="border-[#d7e5d7] bg-[#f7fbf6]"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#24714d]" />Operação governada</CardTitle><CardDescription>Limites desta fase de administração.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-[#466052]"><p>As alterações de IA e ferramentas são registradas na auditoria.</p><p>Não há criação livre de ferramentas, workflows, URLs ou segredos pela interface.</p></CardContent></Card></div></TabsContent>
      <TabsContent value="users" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Usuários e permissões</CardTitle><CardDescription>Memberships desta organização. A alteração de papéis não está disponível nesta fase.</CardDescription></CardHeader><CardContent className="space-y-3">{overview.data?.users.map(member => <div key={`${member.email}-${member.joinedAt}`} className="flex flex-col gap-2 rounded-2xl border border-[#eee9dc] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-[#173b34]">{member.name}</p><p className="truncate text-sm text-muted-foreground">{member.email}</p><p className="mt-1 text-xs text-muted-foreground">Associado em {formatDate(member.joinedAt)}</p></div><Badge variant="outline" className="w-fit capitalize">{member.role}</Badge></div>)}</CardContent></Card></TabsContent>
      <TabsContent value="assistant" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Assistente de IA</CardTitle><CardDescription>Provider e modelo por organização, com fallback determinístico mantido no servidor.</CardDescription></CardHeader><CardContent className="space-y-5">{agentDraft ? <><div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f6f8f4] p-4"><div><p className="font-medium text-[#173b34]">Assistente habilitado</p><p className="text-sm text-muted-foreground">Desabilitar interrompe respostas pelo Gateway desta organização.</p></div><Switch checked={agentDraft.enabled} onCheckedChange={checked => setAgentDraft({ ...agentDraft, enabled: checked })} aria-label="Habilitar assistente" /></div><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-[#31443c]">Provider<select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={agentDraft.provider} onChange={event => setAgentDraft({ ...agentDraft, provider: event.target.value as "legacy" | "hermes" })}><option value="legacy">Local protegido</option><option value="hermes">Hermes opt-in</option></select></label><label className="grid gap-2 text-sm font-medium text-[#31443c]">Modelo<Input value={agentDraft.model} maxLength={160} onChange={event => setAgentDraft({ ...agentDraft, model: event.target.value })} /></label></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ebe4d4] p-4"><div className="text-sm"><p className="font-medium text-[#173b34]">Fallback</p><p className="text-muted-foreground">{gateway.data?.fallbackPolicy === "deterministic" ? "Determinístico e local" : "Protegido"}</p></div><Button disabled={updateAgent.isPending || !agentDraft.model.trim()} onClick={() => updateAgent.mutate({ ...agentDraft, model: agentDraft.model.trim(), fallbackPolicy: "deterministic" })}>{updateAgent.isPending ? "Salvando..." : "Salvar preferências"}</Button></div></> : <SettingsLoading />}</CardContent></Card></TabsContent>
      <TabsContent value="hermes" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Hermes</CardTitle><CardDescription>Diagnóstico sanitizado: chaves, endpoint e conteúdo de conversa nunca são exibidos.</CardDescription></CardHeader><CardContent className="space-y-5">{integrations.data?.hermes ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-[#f6f8f4] p-4"><p className="text-xs text-muted-foreground">Conexão</p><div className="mt-2"><StatusBadge status={integrations.data.hermes.hermes.connection} /></div></div><div className="rounded-2xl bg-[#f6f8f4] p-4"><p className="text-xs text-muted-foreground">Habilitado</p><p className="mt-2 font-medium text-[#173b34]">{integrations.data.hermes.hermes.enabled ? "Sim" : "Não"}</p></div><div className="rounded-2xl bg-[#f6f8f4] p-4"><p className="text-xs text-muted-foreground">Modelo</p><p className="mt-2 truncate font-medium text-[#173b34]">{integrations.data.hermes.hermes.model || "Não configurado"}</p></div><div className="rounded-2xl bg-[#f6f8f4] p-4"><p className="text-xs text-muted-foreground">Latência</p><p className="mt-2 font-medium text-[#173b34]">{integrations.data.hermes.hermes.latencyMs ? `${integrations.data.hermes.hermes.latencyMs} ms` : "Sem medição"}</p></div></div><div className="flex flex-col gap-3 rounded-2xl border border-[#ebe4d4] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-[#173b34]">Teste de conexão explícito</p><p className="text-sm text-muted-foreground">Última falha: {integrations.data.hermes.hermes.lastFailure ?? "nenhuma registrada"}</p></div><Button variant="outline" disabled={testHermes.isPending} onClick={() => testHermes.mutate()}>{testHermes.isPending ? "Testando..." : <><RefreshCw className="mr-2 size-4" />Testar conexão</>}</Button></div></> : null}</CardContent></Card></TabsContent>
      <TabsContent value="voice" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Voz</CardTitle><CardDescription>Estado operacional da entrada de voz compatível com a arquitetura atual.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Entrada de voz</p><p className="mt-1 font-medium text-[#173b34]">{overview.data?.voice.inputEnabled ? "Habilitada" : "Indisponível"}</p></div><div><p className="text-xs text-muted-foreground">Provider</p><p className="mt-1 font-medium text-[#173b34]">{overview.data?.voice.provider}</p></div><div><p className="text-xs text-muted-foreground">Privacidade</p><p className="mt-1 text-sm leading-5 text-[#466052]">{overview.data?.voice.transcriptionVisibility}</p></div></CardContent></Card></TabsContent>
      <TabsContent value="tools" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Ferramentas do agente</CardTitle><CardDescription>Catálogo declarativo. É possível habilitar ou desabilitar somente ferramentas já aprovadas.</CardDescription></CardHeader><CardContent className="space-y-3">{catalog.data?.map(tool => <div key={tool.name} className="flex flex-col gap-3 rounded-2xl border border-[#eee9dc] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[#173b34]">{tool.name}</p><Badge variant="outline">{tool.category}</Badge>{tool.requiresConfirmation ? <Badge className="bg-[#fff0d6] text-[#8c5a0d] hover:bg-[#fff0d6]">Confirmação</Badge> : null}</div><p className="mt-1 text-sm leading-5 text-muted-foreground">{tool.description}</p><p className="mt-2 text-xs text-muted-foreground">Papéis: {tool.authorizedRoles.join(", ")}</p></div><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{tool.enabled ? "Habilitada" : "Desabilitada"}</span><Switch checked={tool.enabled} disabled={updateTool.isPending} onCheckedChange={checked => updateTool.mutate({ name: tool.name, enabled: checked })} aria-label={`Alterar ${tool.name}`} /></div></div>)}</CardContent></Card></TabsContent>
      <TabsContent value="integrations" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Integrações</CardTitle><CardDescription>Conectores governados por allowlist; URLs e webhooks arbitrários não são aceitos.</CardDescription></CardHeader><CardContent>{integrations.data?.n8n ? <div className="rounded-2xl border border-[#eee9dc] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-[#173b34]">n8n</p><p className="mt-1 text-sm text-muted-foreground">Workflows declarados para uso futuro.</p></div><StatusBadge status={integrations.data.n8n.status} /></div><div className="mt-4 flex flex-wrap gap-2">{integrations.data.n8n.allowedWorkflows.map(workflow => <Badge key={workflow} variant="outline">{workflow}</Badge>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Nenhum workflow pode ser criado ou configurado por URL nesta tela.</p></div> : null}</CardContent></Card></TabsContent>
      <TabsContent value="audit" className="mt-5"><Card className="border-[#e7e1d4]"><CardHeader><CardTitle>Auditoria do agente</CardTitle><CardDescription>Últimos eventos desta organização, com requestId e confirmação quando disponíveis.</CardDescription></CardHeader><CardContent className="space-y-3">{overview.data?.auditEvents.length ? overview.data.auditEvents.map(event => <div key={`${event.requestId ?? event.action}-${event.createdAt}`} className="rounded-2xl border border-[#eee9dc] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-[#173b34]">{event.action}</p><StatusBadge status={event.status} /></div><div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2"><span>Usuário: {event.actorName}</span><span>Quando: {formatDate(event.createdAt)}</span><span>Ferramenta: {event.tool ?? "—"}</span><span>Resultado: {event.result ?? "—"}</span><span>Confirmação: {event.confirmationStatus ?? "—"}</span><span>Provider/modelo: {[event.provider, event.model].filter(Boolean).join(" / ") || "—"}</span></div><p className="mt-2 text-xs text-muted-foreground">requestId: {event.requestId ?? "não aplicável"}</p></div>) : <div className="rounded-2xl border border-dashed border-[#d6ddd1] p-6 text-sm text-muted-foreground">Ainda não há ações do agente para esta organização.</div>}</CardContent></Card></TabsContent>
    </Tabs>}</div></DashboardLayout>;
}
